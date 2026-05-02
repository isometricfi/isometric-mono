use candid::CandidType;
use icrc_ledger_types::icrc1::account::Account;
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

use crate::auth::derive_subaccount;
use crate::errors::{error_codes, VolumetricError};
use crate::ic;
use crate::journaling::{
    default_policy, enqueue_if_absent, execute_wal_entry_now, get_entry, ledger_memo,
    register_retryable_error, LedgerMemoKind, OperationId, SettlementWalPayload, WalEntry,
    WalExecutionError, WalExecutionOutcome, WalKind, WalPayload, WalResult, WalStatus,
};
use crate::ledger;
use crate::locks::SettlementLock;
#[cfg(feature = "testing")]
use crate::oracle::get_btc_usd_price_cents;
use crate::oracle::get_btc_usd_price_cents_at_time_seconds;
use crate::oracle::xrc_timestamp_seconds_for_time_seconds;
use crate::storage::{
    add_platform_fee, calculate_call_option_payout, calculate_profit_fee, complete_settlement,
    create_settlement, deduct_locked_collateral, deduct_writer_transfer_fees, emit_event,
    fail_settlement, get_active_option, get_fee_recipient, get_settlement,
    list_expired_active_options, release_locked_to_buyer, remove_settlement, unlock_collateral,
    update_active_option, update_settlement_phase, ActiveOption, ActiveOptionStatus, EventData,
    EventType, OptionType, PendingSettlement, SettlementPhase, TradeRole,
};

use crate::time::current_time_seconds;
use crate::usecases::balances::transfer_ckbtc;

type ExpiredOptionsByXrcTimestampSecs = BTreeMap<u64, Vec<ActiveOption>>;

pub struct SettlementResult {
    pub option_id: u64,
    pub settlement_price_cents: u64,
    pub payout_to_buyer: u64,
    pub payout_to_writer: u64,
    pub profit_fee: u64,
    pub status: ActiveOptionStatus,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
pub struct SettlementWalResult {
    pub option_id: u64,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
pub struct SettlementReceipt {
    pub operation_id: OperationId,
    pub option_id: u64,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, PartialEq)]
pub enum SettlementStatus {
    Pending {
        receipt: SettlementReceipt,
        phase: SettlementPhase,
        last_error: Option<String>,
    },
    Succeeded {
        receipt: SettlementReceipt,
        result: SettlementWalResult,
    },
    RecoveryRequired {
        receipt: SettlementReceipt,
        phase: SettlementPhase,
        last_error: Option<String>,
    },
    Failed {
        receipt: SettlementReceipt,
        message: String,
    },
}

pub struct SettleExpiredOptionsResult {
    pub settled: Vec<SettlementResult>,
    pub errors: Vec<String>,
}

struct PreparedSettlementExecution {
    operation_id: OperationId,
    option_id: u64,
    settlement_price_cents: u64,
    buyer_payout_after_profit_fee_sats: u64,
    writer_payout_before_transfer_fees_sats: u64,
    profit_fee_sats: u64,
}

pub async fn settle_expired_options_use_case() -> SettleExpiredOptionsResult {
    let now_seconds = current_time_seconds();
    let expired_options = list_expired_active_options(now_seconds);
    let expired_options_by_xrc_timestamp_secs =
        group_expired_options_by_xrc_timestamp_secs(expired_options);

    let mut settled: Vec<SettlementResult> = Vec::new();
    let mut errors: Vec<String> = Vec::new();

    for (xrc_timestamp_secs, options_in_xrc_bucket) in expired_options_by_xrc_timestamp_secs {
        // `now_seconds` selects expired options. Pricing uses `expiry_seconds` floored to the XRC
        // hour. Bucket members share that hour, so `first()` supplies any `expiry_seconds` for one
        // oracle call; the inner loop applies that price to each option.
        let Some(first_option_in_xrc_bucket) = options_in_xrc_bucket.first() else {
            continue;
        };

        let settlement_price_cents = match get_btc_usd_price_cents_at_time_seconds(
            first_option_in_xrc_bucket.expiry_seconds,
        )
        .await
        {
            Ok(price) => price,
            Err(e) => {
                errors.push(format!(
                    "Failed to get oracle price for XRC timestamp {}: {}",
                    xrc_timestamp_secs, e
                ));
                continue;
            }
        };

        for option in options_in_xrc_bucket {
            match settle_single_option(option.id, settlement_price_cents).await {
                Ok(result) => settled.push(result),
                Err(e) => errors.push(format!("Option {}: {}", option.id, e)),
            }
        }
    }

    SettleExpiredOptionsResult { settled, errors }
}

fn group_expired_options_by_xrc_timestamp_secs(
    options: Vec<ActiveOption>,
) -> ExpiredOptionsByXrcTimestampSecs {
    let mut options_by_xrc_timestamp_secs = BTreeMap::new();
    for option in options {
        options_by_xrc_timestamp_secs
            .entry(xrc_timestamp_seconds_for_time_seconds(
                option.expiry_seconds,
            ))
            .or_insert_with(Vec::new)
            .push(option);
    }
    options_by_xrc_timestamp_secs
}

pub async fn settle_single_option(
    option_id: u64,
    settlement_price_cents: u64,
) -> Result<SettlementResult, VolumetricError> {
    let _lock = SettlementLock::new(option_id)?;
    let prepared_settlement_execution =
        prepare_settlement_execution(option_id, settlement_price_cents)?;
    let wal_execution_outcome =
        execute_wal_entry_now(prepared_settlement_execution.operation_id).await;

    finish_settlement_execution(prepared_settlement_execution, wal_execution_outcome)
}

fn prepare_settlement_execution(
    option_id: u64,
    settlement_price_cents: u64,
) -> Result<PreparedSettlementExecution, VolumetricError> {
    let mut option = get_active_option(option_id).ok_or_else(|| {
        VolumetricError::from_def(
            error_codes::OPTION_NOT_FOUND,
            Some(&format!("id: {}", option_id)),
            None,
        )
    })?;
    if option.status == ActiveOptionStatus::Settling {
        return Err(VolumetricError::from_def(
            error_codes::OPTION_SETTLING,
            None,
            None,
        ));
    }

    ic::log(&format!(
        "settle_single_option: id={}, status={:?}, settlement_price={}",
        option.id, option.status, settlement_price_cents
    ));

    if option.status != ActiveOptionStatus::Active {
        return Err(VolumetricError::from_def(
            error_codes::OPTION_ALREADY_SETTLED,
            None,
            None,
        ));
    }

    option.status = ActiveOptionStatus::Settling;
    update_active_option(option.clone());

    let buyer_payout_before_profit_fee_sats = match option.option_type {
        OptionType::Call => calculate_call_option_payout(
            settlement_price_cents,
            option.strike_price_cents,
            option.quantity,
        ),
    };
    let profit_fee_sats = if buyer_payout_before_profit_fee_sats > 0 {
        calculate_profit_fee(
            buyer_payout_before_profit_fee_sats,
            option.profit_fee_basis_points,
        )?
    } else {
        0
    };
    let buyer_payout_after_profit_fee_sats =
        buyer_payout_before_profit_fee_sats.saturating_sub(profit_fee_sats);
    let writer_payout_before_transfer_fees_sats = option
        .quantity
        .saturating_sub(buyer_payout_before_profit_fee_sats);
    let transfer_fee_sats = if buyer_payout_before_profit_fee_sats > 0 {
        ledger::get_cached_icrc1_transfer_fee_sats_for_sync_flow()?
    } else {
        0
    };
    let created_at_time_ns = ic::time();

    ic::log(&format!(
        "settle_single_option: quantity={}, buyer_payout_before_profit_fee_sats={}, profit_fee_sats={}, buyer_payout_after_profit_fee_sats={}, writer_payout_before_transfer_fees_sats={}, transfer_fee_sats={}",
        option.quantity,
        buyer_payout_before_profit_fee_sats,
        profit_fee_sats,
        buyer_payout_after_profit_fee_sats,
        writer_payout_before_transfer_fees_sats,
        transfer_fee_sats,
    ));

    create_settlement(
        option.id,
        option.writer,
        option.buyer,
        buyer_payout_after_profit_fee_sats,
        writer_payout_before_transfer_fees_sats,
        settlement_price_cents,
    );

    let operation_id = settlement_operation_id(option.id);
    enqueue_if_absent(
        operation_id,
        WalKind::Settlement,
        WalPayload::Settlement(SettlementWalPayload {
            option_id: option.id,
            settlement_price_cents,
            created_at_time_ns,
            transfer_fee_sats,
        }),
        default_policy(),
    );

    Ok(PreparedSettlementExecution {
        operation_id,
        option_id: option.id,
        settlement_price_cents,
        buyer_payout_after_profit_fee_sats,
        writer_payout_before_transfer_fees_sats,
        profit_fee_sats,
    })
}

fn finish_settlement_execution(
    prepared_settlement_execution: PreparedSettlementExecution,
    wal_execution_outcome: WalExecutionOutcome,
) -> Result<SettlementResult, VolumetricError> {
    match wal_execution_outcome {
        WalExecutionOutcome::Succeeded | WalExecutionOutcome::SucceededAlready => {
            Ok(SettlementResult {
                option_id: prepared_settlement_execution.option_id,
                settlement_price_cents: prepared_settlement_execution.settlement_price_cents,
                payout_to_buyer: prepared_settlement_execution.buyer_payout_after_profit_fee_sats,
                payout_to_writer: prepared_settlement_execution
                    .writer_payout_before_transfer_fees_sats,
                profit_fee: prepared_settlement_execution.profit_fee_sats,
                status: ActiveOptionStatus::Settled,
            })
        }
        WalExecutionOutcome::SkippedAlreadyInFlight | WalExecutionOutcome::RecoveryRequired(_) => {
            Err(VolumetricError::from_def(
                error_codes::INTER_CANISTER_CALL_FAILED,
                Some("settlement requires manual recovery"),
                None,
            ))
        }
        WalExecutionOutcome::FailedPermanent(message) => Err(VolumetricError::from_def(
            error_codes::INTER_CANISTER_CALL_FAILED,
            Some(&message),
            None,
        )),
    }
}

pub async fn run_settlement_wal(
    operation_id: OperationId,
    payload: &SettlementWalPayload,
) -> Result<SettlementWalResult, WalExecutionError> {
    let mut active_option = get_active_option(payload.option_id).ok_or_else(|| {
        WalExecutionError::Permanent(format!("settlement option {} not found", payload.option_id))
    })?;

    if active_option.status == ActiveOptionStatus::Settled {
        return Ok(SettlementWalResult {
            option_id: active_option.id,
        });
    }

    let settlement = get_settlement(payload.option_id).ok_or_else(|| {
        WalExecutionError::Permanent(format!(
            "settlement journal {} not found",
            payload.option_id
        ))
    })?;

    let writer_subaccount = derive_subaccount(active_option.writer);
    let buyer_subaccount = derive_subaccount(active_option.buyer);

    let buyer_payout_after_profit_fee_sats = settlement.payout_to_buyer;
    let writer_payout_before_transfer_fees_sats = settlement.payout_to_writer;

    let buyer_payout_before_profit_fee_sats = active_option
        .quantity
        .saturating_sub(writer_payout_before_transfer_fees_sats);

    let profit_fee_sats =
        buyer_payout_before_profit_fee_sats.saturating_sub(buyer_payout_after_profit_fee_sats);

    let transfer_fee_sats = payload.transfer_fee_sats;
    let transfer_count: u64 =
        (buyer_payout_after_profit_fee_sats > 0) as u64 + (profit_fee_sats > 0) as u64;
    let total_transfer_fees_sats = transfer_count * transfer_fee_sats;

    let writer_payout_after_transfer_fees_sats =
        writer_payout_before_transfer_fees_sats.saturating_sub(total_transfer_fees_sats);

    if settlement.phase == SettlementPhase::Started && buyer_payout_after_profit_fee_sats > 0 {
        transfer_ckbtc(
            Some(writer_subaccount),
            Account {
                owner: ic::canister_self(),
                subaccount: Some(buyer_subaccount),
            },
            buyer_payout_after_profit_fee_sats,
            payload.created_at_time_ns,
            Some(ledger_memo(
                operation_id,
                LedgerMemoKind::SettlementBuyerPayout,
                &[],
            )),
        )
        .await
        .map_err(register_retryable_error)?;

        update_settlement_phase(active_option.id, SettlementPhase::TransferComplete);
    }

    let settlement = get_settlement(payload.option_id).ok_or_else(|| {
        WalExecutionError::Permanent(format!(
            "settlement journal {} missing after transfer",
            active_option.id
        ))
    })?;

    if matches!(
        settlement.phase,
        SettlementPhase::Started | SettlementPhase::TransferComplete
    ) {
        if buyer_payout_after_profit_fee_sats > 0 {
            release_locked_to_buyer(
                active_option.writer,
                active_option.buyer,
                buyer_payout_after_profit_fee_sats,
            )
            .map_err(map_balance_error_to_permanent)?;
        }

        update_settlement_phase(active_option.id, SettlementPhase::BalanceReleased);
    }

    let settlement = get_settlement(payload.option_id).ok_or_else(|| {
        WalExecutionError::Permanent(format!(
            "settlement journal {} missing before finalization",
            active_option.id
        ))
    })?;

    if settlement.phase == SettlementPhase::BalanceReleased {
        if profit_fee_sats > 0 {
            transfer_ckbtc(
                Some(writer_subaccount),
                Account {
                    owner: get_fee_recipient(),
                    subaccount: None,
                },
                profit_fee_sats,
                payload.created_at_time_ns,
                Some(ledger_memo(
                    operation_id,
                    LedgerMemoKind::SettlementProfitFee,
                    &[],
                )),
            )
            .await
            .map_err(register_retryable_error)?;

            add_platform_fee(profit_fee_sats);
            deduct_locked_collateral(active_option.writer, profit_fee_sats)
                .map_err(map_balance_error_to_permanent)?;
        }

        if total_transfer_fees_sats > 0 {
            deduct_writer_transfer_fees(active_option.writer, total_transfer_fees_sats)
                .map_err(map_balance_error_to_permanent)?;
        }

        update_settlement_phase(active_option.id, SettlementPhase::ProfitFeeCollected);
    }

    let settlement = get_settlement(payload.option_id).ok_or_else(|| {
        WalExecutionError::Permanent(format!(
            "settlement journal {} missing before writer payout",
            active_option.id
        ))
    })?;

    if settlement.phase == SettlementPhase::ProfitFeeCollected {
        if writer_payout_after_transfer_fees_sats > 0 {
            unlock_collateral(active_option.writer, writer_payout_after_transfer_fees_sats)
                .map_err(map_balance_error_to_permanent)?;
        }

        update_settlement_phase(active_option.id, SettlementPhase::WriterPayoutReleased);
    }

    let settlement = get_settlement(payload.option_id).ok_or_else(|| {
        WalExecutionError::Permanent(format!(
            "settlement journal {} missing before completion",
            active_option.id
        ))
    })?;

    if settlement.phase != SettlementPhase::WriterPayoutReleased {
        return Err(WalExecutionError::Permanent(format!(
            "settlement {} in unexpected phase {:?}",
            active_option.id, settlement.phase
        )));
    }

    active_option.status = ActiveOptionStatus::Settled;
    update_active_option(active_option.clone());

    complete_settlement(active_option.id);
    remove_settlement(active_option.id);

    let settled_at_seconds = current_time_seconds();

    emit_event(
        active_option.buyer,
        EventType::OptionSettled,
        EventData::OptionSettled {
            option_id: active_option.id,
            quantity_sats: active_option.quantity,
            entry_price_cents: active_option.entry_price_cents,
            strike_price_cents: active_option.strike_price_cents,
            settlement_price_cents: payload.settlement_price_cents,
            premium_sats: active_option.premium_paid,
            payout_sats: buyer_payout_after_profit_fee_sats,
            accepted_at_seconds: active_option.accepted_at_seconds,
            settled_at_seconds,
            role: TradeRole::Buyer,
        },
    );

    emit_event(
        active_option.writer,
        EventType::OptionSettled,
        EventData::OptionSettled {
            option_id: active_option.id,
            quantity_sats: active_option.quantity,
            entry_price_cents: active_option.entry_price_cents,
            strike_price_cents: active_option.strike_price_cents,
            settlement_price_cents: payload.settlement_price_cents,
            premium_sats: active_option.premium_paid,
            payout_sats: writer_payout_after_transfer_fees_sats,
            accepted_at_seconds: active_option.accepted_at_seconds,
            settled_at_seconds,
            role: TradeRole::Writer,
        },
    );

    Ok(SettlementWalResult {
        option_id: active_option.id,
    })
}

fn settlement_operation_id(option_id: u64) -> OperationId {
    let option_id_bytes = option_id.to_be_bytes();
    OperationId::from_parts(&[b"settlement", &option_id_bytes])
}

fn build_settlement_receipt_from_wal_entry(
    operation_id: OperationId,
    wal_entry: &WalEntry,
) -> Result<SettlementReceipt, VolumetricError> {
    let WalPayload::Settlement(payload) = &wal_entry.payload else {
        return Err(VolumetricError::from_def(
            error_codes::INTERNAL_ERROR,
            Some("settlement receipt loaded from unexpected wal payload"),
            None,
        ));
    };

    Ok(SettlementReceipt {
        operation_id,
        option_id: payload.option_id,
    })
}

fn load_receipt_if_settlement_exists(
    operation_id: OperationId,
) -> Result<Option<SettlementReceipt>, VolumetricError> {
    let Some(existing_wal_entry) = get_entry(operation_id) else {
        return Ok(None);
    };

    build_settlement_receipt_from_wal_entry(operation_id, &existing_wal_entry).map(Some)
}

fn load_settlement_wal_result(
    operation_id: OperationId,
) -> Result<SettlementWalResult, VolumetricError> {
    let wal_entry = get_entry(operation_id).ok_or_else(|| {
        VolumetricError::from_def(
            error_codes::INTERNAL_ERROR,
            Some("settlement completed without wal entry"),
            None,
        )
    })?;
    let wal_result = wal_entry.result.ok_or_else(|| {
        VolumetricError::from_def(
            error_codes::INTERNAL_ERROR,
            Some("settlement completed without result"),
            None,
        )
    })?;

    match wal_result {
        WalResult::Settlement(result) => Ok(result),
        _ => Err(VolumetricError::from_def(
            error_codes::INTERNAL_ERROR,
            Some("settlement completed with unexpected wal result type"),
            None,
        )),
    }
}

fn load_settlement_journal_entry(option_id: u64) -> Result<PendingSettlement, VolumetricError> {
    get_settlement(option_id).ok_or_else(|| {
        VolumetricError::from_def(
            error_codes::INTERNAL_ERROR,
            Some("settlement journal entry not found"),
            None,
        )
    })
}

fn load_failed_settlement_message(
    option_id: u64,
    wal_last_error: Option<String>,
) -> Result<String, VolumetricError> {
    if let Some(pending_settlement) = get_settlement(option_id) {
        if let SettlementPhase::Failed { reason } = pending_settlement.phase {
            return Ok(reason);
        }
    }

    wal_last_error.ok_or_else(|| {
        VolumetricError::from_def(
            error_codes::INTERNAL_ERROR,
            Some("failed settlement missing error message"),
            None,
        )
    })
}

fn schedule_settlement_wal_execution(operation_id: OperationId) {
    #[cfg(target_arch = "wasm32")]
    ic_cdk::futures::spawn(async move {
        let _ = crate::journaling::execute_wal_entry_now(operation_id).await;
    });

    #[cfg(not(target_arch = "wasm32"))]
    let _ = operation_id;
}

fn map_balance_error_to_permanent(error: crate::storage::InsufficientBalance) -> WalExecutionError {
    WalExecutionError::Permanent(format!(
        "insufficient balance during settlement recovery: available={}, required={}",
        error.available, error.required
    ))
}

pub(crate) fn finalize_failed_settlement_wal(payload: &SettlementWalPayload, message: &str) {
    let Some(settlement) = get_settlement(payload.option_id) else {
        return;
    };

    if matches!(
        settlement.phase,
        SettlementPhase::Completed | SettlementPhase::Failed { .. }
    ) {
        return;
    }

    fail_settlement(payload.option_id, message.to_string());

    if let Some(mut option) = get_active_option(payload.option_id) {
        if option.status == ActiveOptionStatus::Settling {
            option.status = ActiveOptionStatus::Expired;
            update_active_option(option.clone());
        }

        emit_event(
            option.buyer,
            EventType::OptionSettlementFailed,
            EventData::OptionSettlementFailed {
                option_id: option.id,
                reason: message.to_string(),
            },
        );
        emit_event(
            option.writer,
            EventType::OptionSettlementFailed,
            EventData::OptionSettlementFailed {
                option_id: option.id,
                reason: message.to_string(),
            },
        );
    }
}

pub fn get_settlement_status_use_case(
    operation_id: OperationId,
) -> Result<SettlementStatus, VolumetricError> {
    let wal_entry = get_entry(operation_id).ok_or_else(|| {
        VolumetricError::from_def(
            error_codes::INTERNAL_ERROR,
            Some("settlement not found"),
            None,
        )
    })?;
    let settlement_receipt = build_settlement_receipt_from_wal_entry(operation_id, &wal_entry)?;

    match wal_entry.status {
        WalStatus::Succeeded => Ok(SettlementStatus::Succeeded {
            receipt: settlement_receipt,
            result: load_settlement_wal_result(operation_id)?,
        }),
        WalStatus::FailedPermanent => Ok(SettlementStatus::Failed {
            receipt: settlement_receipt.clone(),
            message: load_failed_settlement_message(
                settlement_receipt.option_id,
                wal_entry.last_err,
            )?,
        }),
        WalStatus::Enqueued | WalStatus::InFlight => {
            let pending_settlement = load_settlement_journal_entry(settlement_receipt.option_id)?;
            Ok(SettlementStatus::Pending {
                receipt: settlement_receipt,
                phase: pending_settlement.phase,
                last_error: wal_entry.last_err,
            })
        }
        WalStatus::RecoveryRequired => {
            let pending_settlement = load_settlement_journal_entry(settlement_receipt.option_id)?;
            Ok(SettlementStatus::RecoveryRequired {
                receipt: settlement_receipt,
                phase: pending_settlement.phase,
                last_error: wal_entry.last_err,
            })
        }
    }
}

pub async fn settle_option_by_id_use_case(
    option_id: u64,
) -> Result<SettlementReceipt, VolumetricError> {
    let now_seconds = current_time_seconds();

    let option = get_active_option(option_id).ok_or_else(|| {
        VolumetricError::from_def(
            error_codes::OPTION_NOT_FOUND,
            Some(&format!("id: {}", option_id)),
            None,
        )
    })?;

    if option.expiry_seconds > now_seconds {
        return Err(VolumetricError::from_def(
            error_codes::OPTION_NOT_EXPIRED,
            None,
            None,
        ));
    }

    let settlement_price_cents =
        get_btc_usd_price_cents_at_time_seconds(option.expiry_seconds).await?;
    queue_settlement_execution(option_id, settlement_price_cents)
}

#[cfg(feature = "testing")]
pub async fn testing_force_settle_option_use_case(
    option_id: u64,
) -> Result<SettlementReceipt, VolumetricError> {
    let settlement_price_cents = get_btc_usd_price_cents().await?;
    queue_settlement_execution(option_id, settlement_price_cents)
}

fn queue_settlement_execution(
    option_id: u64,
    settlement_price_cents: u64,
) -> Result<SettlementReceipt, VolumetricError> {
    let operation_id = settlement_operation_id(option_id);
    if let Some(existing_receipt) = load_receipt_if_settlement_exists(operation_id)? {
        return Ok(existing_receipt);
    }

    let _lock = SettlementLock::new(option_id)?;
    let prepared_settlement_execution =
        prepare_settlement_execution(option_id, settlement_price_cents)?;
    let receipt = SettlementReceipt {
        operation_id: prepared_settlement_execution.operation_id,
        option_id: prepared_settlement_execution.option_id,
    };
    schedule_settlement_wal_execution(receipt.operation_id);

    Ok(receipt)
}

#[cfg(feature = "testing")]
pub fn testing_expire_option_use_case(option_id: u64) -> Result<ActiveOption, VolumetricError> {
    let mut option = get_active_option(option_id).ok_or_else(|| {
        VolumetricError::from_def(
            error_codes::OPTION_NOT_FOUND,
            Some(&format!("id: {}", option_id)),
            None,
        )
    })?;

    if option.status != ActiveOptionStatus::Active {
        return Err(VolumetricError::from_def(
            error_codes::OPTION_ALREADY_SETTLED,
            None,
            None,
        ));
    }

    option.expiry_seconds = 0;
    update_active_option(option.clone());

    Ok(option)
}

#[cfg(feature = "testing")]
pub fn testing_set_option_expiry_use_case(
    option_id: u64,
    expiry_seconds: u64,
) -> Result<ActiveOption, VolumetricError> {
    let mut option = get_active_option(option_id).ok_or_else(|| {
        VolumetricError::from_def(
            error_codes::OPTION_NOT_FOUND,
            Some(&format!("id: {}", option_id)),
            None,
        )
    })?;

    if option.status != ActiveOptionStatus::Active {
        return Err(VolumetricError::from_def(
            error_codes::OPTION_ALREADY_SETTLED,
            None,
            None,
        ));
    }

    option.expiry_seconds = expiry_seconds;
    update_active_option(option.clone());

    Ok(option)
}

#[cfg(test)]
mod tests {
    use std::cell::{Cell, RefCell};
    use std::collections::BTreeSet;
    use std::rc::Rc;

    use async_trait::async_trait;
    use candid::{Nat, Principal};
    use icrc_ledger_types::icrc1::transfer::Memo;
    use icrc_ledger_types::icrc2::approve::ApproveArgs;

    use super::*;
    use crate::ic::IcRuntime;
    use crate::ledger::{self, set_cached_transfer_fee_for_testing, LedgerClient};
    use crate::oracle::{set_oracle, PriceOracle, StubOracle};
    use crate::storage::{
        clear_active_options, clear_events, get_balance, get_platform_fees_collected,
        get_settlement, insert_active_option, list_failed_settlements,
        list_pending_settlements_journal, remove_settlement, set_balance, subtract_available,
        UserBalance,
    };

    const TEST_NOW_NS: u64 = 1_000_000_000_000;
    const TEST_OPTION_ID: u64 = 1;
    const TEST_QUANTITY_SATS: u64 = 1_000_000;
    const TEST_ENTRY_PRICE_CENTS: u64 = 10_000_000;
    const TEST_STRIKE_PRICE_CENTS: u64 = 10_500_000;
    const TEST_SETTLEMENT_PRICE_CENTS: u64 = 12_000_000;
    const TEST_PROFIT_FEE_BASIS_POINTS: u64 = 1_000;
    const TEST_OTM_SETTLEMENT_PRICE_CENTS: u64 = 10_000_000;
    const TEST_NOW_SECONDS: u64 = TEST_NOW_NS / crate::time::NANOS_PER_SECOND;
    const TEST_ONE_HOUR_SECONDS: u64 = 3_600;
    const EXPECTED_GROSS_BUYER_PAYOUT_SATS: u64 = 125_000;
    const EXPECTED_PROFIT_FEE_SATS: u64 = 12_500;
    const EXPECTED_BUYER_PAYOUT_SATS: u64 =
        EXPECTED_GROSS_BUYER_PAYOUT_SATS - EXPECTED_PROFIT_FEE_SATS;
    const EXPECTED_WRITER_PAYOUT_SATS: u64 = TEST_QUANTITY_SATS - EXPECTED_GROSS_BUYER_PAYOUT_SATS;

    struct MockRuntime;

    impl IcRuntime for MockRuntime {
        fn time(&self) -> u64 {
            TEST_NOW_NS
        }

        fn canister_self(&self) -> Principal {
            Principal::anonymous()
        }

        fn log(&self, _message: &str) {}
    }

    struct RuntimeAt {
        now_ns: u64,
    }

    impl IcRuntime for RuntimeAt {
        fn time(&self) -> u64 {
            self.now_ns
        }

        fn canister_self(&self) -> Principal {
            Principal::anonymous()
        }

        fn log(&self, _message: &str) {}
    }

    struct FailingBuyerTransferLedger;

    #[async_trait(?Send)]
    impl LedgerClient for FailingBuyerTransferLedger {
        async fn icrc1_transfer(
            &self,
            _from_subaccount: Option<[u8; 32]>,
            _to: Account,
            _amount: u64,
            _created_at_time: u64,
            _memo: Option<Memo>,
        ) -> Result<u64, VolumetricError> {
            Err(VolumetricError::from_def(
                error_codes::INTER_CANISTER_CALL_FAILED,
                Some("buyer transfer failed"),
                None,
            ))
        }

        async fn icrc1_balance_of(&self, _account: Account) -> Result<Nat, VolumetricError> {
            Ok(Nat::from(0u64))
        }

        async fn icrc2_approve(&self, _args: ApproveArgs) -> Result<Nat, VolumetricError> {
            Ok(Nat::from(0u64))
        }

        async fn icrc1_fee(&self) -> Result<u64, VolumetricError> {
            Ok(10)
        }
    }

    struct RetryableProfitFeeTransferLedger {
        transfer_call_count: RefCell<u64>,
        did_fail_profit_fee_transfer: RefCell<bool>,
    }

    struct WriterSpendDuringProfitFeeTransferLedger {
        writer: Principal,
        transfer_call_count: RefCell<u64>,
        writer_spend_succeeded: Rc<Cell<bool>>,
    }

    impl RetryableProfitFeeTransferLedger {
        fn new() -> Self {
            Self {
                transfer_call_count: RefCell::new(0),
                did_fail_profit_fee_transfer: RefCell::new(false),
            }
        }

        fn transfer_call_count(&self) -> u64 {
            *self.transfer_call_count.borrow()
        }
    }

    #[async_trait(?Send)]
    impl LedgerClient for RetryableProfitFeeTransferLedger {
        async fn icrc1_transfer(
            &self,
            _from_subaccount: Option<[u8; 32]>,
            _to: Account,
            _amount: u64,
            _created_at_time: u64,
            _memo: Option<Memo>,
        ) -> Result<u64, VolumetricError> {
            let mut transfer_call_count = self.transfer_call_count.borrow_mut();
            *transfer_call_count = transfer_call_count.saturating_add(1);

            if *transfer_call_count == 2 {
                let mut did_fail_profit_fee_transfer =
                    self.did_fail_profit_fee_transfer.borrow_mut();
                if !*did_fail_profit_fee_transfer {
                    *did_fail_profit_fee_transfer = true;
                    return Err(VolumetricError::from_def(
                        error_codes::INTER_CANISTER_CALL_FAILED,
                        Some("temporarily unavailable"),
                        None,
                    ));
                }
            }

            Ok(*transfer_call_count)
        }

        async fn icrc1_balance_of(&self, _account: Account) -> Result<Nat, VolumetricError> {
            Ok(Nat::from(0u64))
        }

        async fn icrc2_approve(&self, _args: ApproveArgs) -> Result<Nat, VolumetricError> {
            Ok(Nat::from(0u64))
        }

        async fn icrc1_fee(&self) -> Result<u64, VolumetricError> {
            Ok(10)
        }
    }

    #[async_trait(?Send)]
    impl LedgerClient for WriterSpendDuringProfitFeeTransferLedger {
        async fn icrc1_transfer(
            &self,
            _from_subaccount: Option<[u8; 32]>,
            _to: Account,
            _amount: u64,
            _created_at_time: u64,
            _memo: Option<Memo>,
        ) -> Result<u64, VolumetricError> {
            let mut transfer_call_count = self.transfer_call_count.borrow_mut();
            *transfer_call_count = transfer_call_count.saturating_add(1);

            const PROFIT_FEE_TRANSFER_CALL_NUMBER: u64 = 2;
            if *transfer_call_count == PROFIT_FEE_TRANSFER_CALL_NUMBER
                && subtract_available(self.writer, EXPECTED_PROFIT_FEE_SATS).is_ok()
            {
                self.writer_spend_succeeded.set(true);
            }

            Ok(*transfer_call_count)
        }

        async fn icrc1_balance_of(&self, _account: Account) -> Result<Nat, VolumetricError> {
            Ok(Nat::from(0u64))
        }

        async fn icrc2_approve(&self, _args: ApproveArgs) -> Result<Nat, VolumetricError> {
            Ok(Nat::from(0u64))
        }

        async fn icrc1_fee(&self) -> Result<u64, VolumetricError> {
            Ok(10)
        }
    }

    struct TrapAfterFirstTransferOnceLedger {
        transfer_call_count: RefCell<u64>,
        did_trap_on_second_transfer: RefCell<bool>,
    }

    #[derive(Clone, Debug, PartialEq, Eq)]
    struct RecordedLedgerTransfer {
        from_subaccount: Option<[u8; 32]>,
        to: Account,
        amount_sats: u64,
        created_at_time_ns: u64,
        memo: Option<Memo>,
    }

    struct RecordingTransferLedger {
        transfers: Rc<RefCell<Vec<RecordedLedgerTransfer>>>,
    }

    struct AlwaysFailingRecordingTransferLedger {
        transfer_memos: Rc<RefCell<Vec<Option<Memo>>>>,
    }

    impl RecordingTransferLedger {
        fn new() -> (Self, Rc<RefCell<Vec<RecordedLedgerTransfer>>>) {
            let transfers = Rc::new(RefCell::new(Vec::new()));
            (
                Self {
                    transfers: transfers.clone(),
                },
                transfers,
            )
        }
    }

    impl AlwaysFailingRecordingTransferLedger {
        fn new() -> (Self, Rc<RefCell<Vec<Option<Memo>>>>) {
            let transfer_memos = Rc::new(RefCell::new(Vec::new()));
            (
                Self {
                    transfer_memos: transfer_memos.clone(),
                },
                transfer_memos,
            )
        }
    }

    impl TrapAfterFirstTransferOnceLedger {
        fn new() -> Self {
            Self {
                transfer_call_count: RefCell::new(0),
                did_trap_on_second_transfer: RefCell::new(false),
            }
        }

        fn transfer_call_count(&self) -> u64 {
            *self.transfer_call_count.borrow()
        }
    }

    #[async_trait(?Send)]
    impl LedgerClient for RecordingTransferLedger {
        async fn icrc1_transfer(
            &self,
            from_subaccount: Option<[u8; 32]>,
            to: Account,
            amount: u64,
            created_at_time: u64,
            memo: Option<Memo>,
        ) -> Result<u64, VolumetricError> {
            let mut transfers = self.transfers.borrow_mut();
            transfers.push(RecordedLedgerTransfer {
                from_subaccount,
                to,
                amount_sats: amount,
                created_at_time_ns: created_at_time,
                memo,
            });
            Ok(transfers.len() as u64)
        }

        async fn icrc1_balance_of(&self, _account: Account) -> Result<Nat, VolumetricError> {
            Ok(Nat::from(0u64))
        }

        async fn icrc2_approve(&self, _args: ApproveArgs) -> Result<Nat, VolumetricError> {
            Ok(Nat::from(0u64))
        }

        async fn icrc1_fee(&self) -> Result<u64, VolumetricError> {
            Ok(10)
        }
    }

    #[async_trait(?Send)]
    impl LedgerClient for AlwaysFailingRecordingTransferLedger {
        async fn icrc1_transfer(
            &self,
            _from_subaccount: Option<[u8; 32]>,
            _to: Account,
            _amount: u64,
            _created_at_time: u64,
            memo: Option<Memo>,
        ) -> Result<u64, VolumetricError> {
            self.transfer_memos.borrow_mut().push(memo);
            Err(VolumetricError::from_def(
                error_codes::INTER_CANISTER_CALL_FAILED,
                Some("buyer transfer temporarily unavailable"),
                None,
            ))
        }

        async fn icrc1_balance_of(&self, _account: Account) -> Result<Nat, VolumetricError> {
            Ok(Nat::from(0u64))
        }

        async fn icrc2_approve(&self, _args: ApproveArgs) -> Result<Nat, VolumetricError> {
            Ok(Nat::from(0u64))
        }

        async fn icrc1_fee(&self) -> Result<u64, VolumetricError> {
            Ok(10)
        }
    }

    struct RecordingOracle {
        prices_by_time_seconds: BTreeMap<u64, u64>,
        requested_times_seconds: Rc<RefCell<Vec<u64>>>,
    }

    impl RecordingOracle {
        fn new(prices_by_time_seconds: BTreeMap<u64, u64>) -> (Self, Rc<RefCell<Vec<u64>>>) {
            let requested_times_seconds = Rc::new(RefCell::new(Vec::new()));
            (
                Self {
                    prices_by_time_seconds,
                    requested_times_seconds: requested_times_seconds.clone(),
                },
                requested_times_seconds,
            )
        }
    }

    #[async_trait(?Send)]
    impl PriceOracle for RecordingOracle {
        async fn get_btc_usd_price_cents(&self) -> Result<u64, VolumetricError> {
            self.get_btc_usd_price_cents_at_time_seconds(current_time_seconds())
                .await
        }

        async fn get_btc_usd_price_cents_at_time_seconds(
            &self,
            settlement_time_seconds: u64,
        ) -> Result<u64, VolumetricError> {
            self.requested_times_seconds
                .borrow_mut()
                .push(settlement_time_seconds);
            self.prices_by_time_seconds
                .get(&settlement_time_seconds)
                .copied()
                .ok_or_else(|| {
                    VolumetricError::from_def(
                        error_codes::INTER_CANISTER_CALL_FAILED,
                        Some("missing test oracle price"),
                        None,
                    )
                })
        }
    }

    #[async_trait(?Send)]
    impl LedgerClient for TrapAfterFirstTransferOnceLedger {
        async fn icrc1_transfer(
            &self,
            _from_subaccount: Option<[u8; 32]>,
            _to: Account,
            _amount: u64,
            _created_at_time: u64,
            _memo: Option<Memo>,
        ) -> Result<u64, VolumetricError> {
            let mut transfer_call_count = self.transfer_call_count.borrow_mut();
            *transfer_call_count = transfer_call_count.saturating_add(1);

            if *transfer_call_count == 2 {
                let mut did_trap_on_second_transfer = self.did_trap_on_second_transfer.borrow_mut();
                if !*did_trap_on_second_transfer {
                    *did_trap_on_second_transfer = true;
                    panic!("simulated trap after first settlement transfer");
                }
            }

            Ok(*transfer_call_count)
        }

        async fn icrc1_balance_of(&self, _account: Account) -> Result<Nat, VolumetricError> {
            Ok(Nat::from(0u64))
        }

        async fn icrc2_approve(&self, _args: ApproveArgs) -> Result<Nat, VolumetricError> {
            Ok(Nat::from(0u64))
        }

        async fn icrc1_fee(&self) -> Result<u64, VolumetricError> {
            Ok(10)
        }
    }

    fn test_principal(seed: u8) -> Principal {
        Principal::from_slice(&[seed; 29])
    }

    fn clear_settlement_journal() {
        for settlement in list_pending_settlements_journal() {
            remove_settlement(settlement.option_id);
        }

        for settlement in list_failed_settlements() {
            remove_settlement(settlement.option_id);
        }
    }

    fn setup_test_state_with_ledger(
        writer: Principal,
        buyer: Principal,
        ledger_client: Rc<dyn LedgerClient>,
    ) {
        clear_active_options();
        clear_events();
        clear_settlement_journal();
        ic::set_runtime(Box::new(MockRuntime));
        ledger::set_ledger(ledger_client);
        set_cached_transfer_fee_for_testing(10, TEST_NOW_SECONDS);

        set_balance(
            writer,
            UserBalance {
                available: 0,
                locked_as_writer: TEST_QUANTITY_SATS,
            },
        );
        set_balance(
            buyer,
            UserBalance {
                available: 0,
                locked_as_writer: 0,
            },
        );

        insert_active_option(ActiveOption {
            id: TEST_OPTION_ID,
            offer_id: 1,
            buyer,
            writer,
            asset: crate::storage::Asset::CkBtc,
            option_type: OptionType::Call,
            quantity: TEST_QUANTITY_SATS,
            entry_price_cents: TEST_ENTRY_PRICE_CENTS,
            strike_price_cents: TEST_STRIKE_PRICE_CENTS,
            premium_paid: 10_000,
            accepted_at_seconds: TEST_NOW_SECONDS,
            expiry_seconds: TEST_NOW_SECONDS.saturating_sub(1),
            status: ActiveOptionStatus::Active,
            fill_group_id: None,
            profit_fee_basis_points: TEST_PROFIT_FEE_BASIS_POINTS,
        });
    }

    fn setup_test_state(writer: Principal, buyer: Principal) {
        setup_test_state_with_ledger(writer, buyer, Rc::new(FailingBuyerTransferLedger));
    }

    fn setup_clean_option_state(writer: Principal, buyer: Principal, writer_locked_sats: u64) {
        clear_active_options();
        clear_events();
        clear_settlement_journal();
        ic::set_runtime(Box::new(MockRuntime));
        set_cached_transfer_fee_for_testing(10, TEST_NOW_SECONDS);

        set_balance(
            writer,
            UserBalance {
                available: 0,
                locked_as_writer: writer_locked_sats,
            },
        );
        set_balance(
            buyer,
            UserBalance {
                available: 0,
                locked_as_writer: 0,
            },
        );
    }

    fn insert_test_option(
        option_id: u64,
        writer: Principal,
        buyer: Principal,
        expiry_seconds: u64,
    ) {
        insert_active_option(ActiveOption {
            id: option_id,
            offer_id: option_id,
            buyer,
            writer,
            asset: crate::storage::Asset::CkBtc,
            option_type: OptionType::Call,
            quantity: TEST_QUANTITY_SATS,
            entry_price_cents: TEST_ENTRY_PRICE_CENTS,
            strike_price_cents: TEST_STRIKE_PRICE_CENTS,
            premium_paid: 10_000,
            accepted_at_seconds: TEST_NOW_SECONDS.saturating_sub(TEST_ONE_HOUR_SECONDS),
            expiry_seconds,
            status: ActiveOptionStatus::Active,
            fill_group_id: None,
            profit_fee_basis_points: TEST_PROFIT_FEE_BASIS_POINTS,
        });
    }

    fn execute_wal_entry_now_blocking(operation_id: OperationId) -> WalExecutionOutcome {
        let runtime = tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .expect("tokio runtime should build");
        runtime.block_on(async { crate::journaling::execute_wal_entry_now(operation_id).await })
    }

    /// Given: settlement needs to pay the buyer and collect a profit fee
    /// When: the first ledger transfer to the buyer fails
    /// Then: no internal balance changes leak across the await boundary and WAL recovery keeps the option pending
    #[tokio::test]
    async fn test_settle_single_option_keeps_balances_atomic_on_buyer_transfer_failure() {
        // given
        let writer = test_principal(1);
        let buyer = test_principal(2);
        setup_test_state(writer, buyer);

        // when
        let result = settle_single_option(TEST_OPTION_ID, TEST_SETTLEMENT_PRICE_CENTS).await;

        // then
        assert!(
            result.is_err(),
            "settlement should fail when buyer transfer fails"
        );
        let error = result.err().expect("settlement should return an error");
        assert_eq!(error.code, error_codes::INTER_CANISTER_CALL_FAILED.code);

        let writer_balance = get_balance(&writer);
        assert_eq!(writer_balance.available, 0);
        assert_eq!(writer_balance.locked_as_writer, TEST_QUANTITY_SATS);

        let buyer_balance = get_balance(&buyer);
        assert_eq!(buyer_balance.available, 0);
        assert_eq!(buyer_balance.locked_as_writer, 0);

        let option = get_active_option(TEST_OPTION_ID).expect("option should remain in storage");
        assert_eq!(option.status, ActiveOptionStatus::Settling);

        let settlement = get_settlement(TEST_OPTION_ID).expect("failed settlement should remain");
        assert_eq!(settlement.phase, SettlementPhase::Started);
    }

    /// Given: a valid expired option and a deterministic oracle price
    /// When: settle_option_by_id_use_case is called
    /// Then: it returns a receipt immediately and status remains pending before WAL execution runs
    #[tokio::test]
    async fn test_settle_option_by_id_returns_receipt_and_pending_status() {
        // given
        let writer = test_principal(1);
        let buyer = test_principal(2);
        setup_test_state(writer, buyer);
        set_oracle(Rc::new(StubOracle::new(TEST_SETTLEMENT_PRICE_CENTS)));

        // when
        let receipt = settle_option_by_id_use_case(TEST_OPTION_ID)
            .await
            .expect("settle by id should enqueue settlement");
        let status = get_settlement_status_use_case(receipt.operation_id)
            .expect("status should load for enqueued settlement");

        // then
        assert_eq!(receipt.option_id, TEST_OPTION_ID);
        match status {
            SettlementStatus::Pending {
                receipt: status_receipt,
                phase,
                last_error,
            } => {
                assert_eq!(status_receipt.option_id, TEST_OPTION_ID);
                assert_eq!(phase, SettlementPhase::Started);
                assert_eq!(last_error, None);
            }
            _ => panic!("settlement should be pending before WAL execution"),
        }
    }

    /// Given: a valid expired option and a deterministic oracle that records requested times
    /// When: settle_option_by_id_use_case is called after the option expiry
    /// Then: it requests the XRC price for the option expiry timestamp
    #[tokio::test]
    async fn test_settle_option_by_id_requests_price_at_option_expiry() {
        // given
        const OPTION_ID: u64 = 201;
        const OPTION_EXPIRY_SECONDS: u64 = TEST_NOW_SECONDS - 1;
        let writer = test_principal(41);
        let buyer = test_principal(42);
        setup_clean_option_state(writer, buyer, TEST_QUANTITY_SATS);
        insert_test_option(OPTION_ID, writer, buyer, OPTION_EXPIRY_SECONDS);

        let (oracle, requested_times_seconds) = RecordingOracle::new(BTreeMap::from([(
            OPTION_EXPIRY_SECONDS,
            TEST_OTM_SETTLEMENT_PRICE_CENTS,
        )]));
        set_oracle(Rc::new(oracle));

        // when
        let receipt = settle_option_by_id_use_case(OPTION_ID)
            .await
            .expect("settle by id should enqueue settlement");
        let wal_entry = get_entry(receipt.operation_id).expect("wal entry should exist");

        // then
        assert_eq!(
            *requested_times_seconds.borrow(),
            vec![OPTION_EXPIRY_SECONDS]
        );
        let WalPayload::Settlement(settlement_payload) = wal_entry.payload else {
            panic!("settlement WAL entry should contain settlement payload");
        };
        assert_eq!(
            settlement_payload.settlement_price_cents,
            TEST_OTM_SETTLEMENT_PRICE_CENTS
        );
    }

    /// Given: expired options with different raw expiries in the same XRC timestamp bucket
    /// When: settle_expired_options_use_case runs
    /// Then: it fetches one settlement price for the shared XRC timestamp bucket
    #[tokio::test]
    async fn test_settle_expired_options_groups_oracle_fetches_by_xrc_timestamp() {
        // given
        const FIRST_OPTION_ID: u64 = 301;
        const SECOND_OPTION_ID: u64 = 302;
        const THIRD_OPTION_ID: u64 = 303;
        const FIRST_EXPIRY_SECONDS: u64 = TEST_NOW_SECONDS - 1;
        const SECOND_EXPIRY_SECONDS: u64 = TEST_NOW_SECONDS - 2;
        const XRC_BUCKET_PRICE_CENTS: u64 = 10_000_000;

        let writer = test_principal(51);
        let buyer = test_principal(52);
        setup_clean_option_state(writer, buyer, TEST_QUANTITY_SATS * 3);
        insert_test_option(FIRST_OPTION_ID, writer, buyer, FIRST_EXPIRY_SECONDS);
        insert_test_option(SECOND_OPTION_ID, writer, buyer, FIRST_EXPIRY_SECONDS);
        insert_test_option(THIRD_OPTION_ID, writer, buyer, SECOND_EXPIRY_SECONDS);

        let (oracle, requested_times_seconds) = RecordingOracle::new(BTreeMap::from([(
            FIRST_EXPIRY_SECONDS,
            XRC_BUCKET_PRICE_CENTS,
        )]));
        set_oracle(Rc::new(oracle));

        // when
        let result = settle_expired_options_use_case().await;

        // then
        assert!(result.errors.is_empty());
        assert_eq!(
            *requested_times_seconds.borrow(),
            vec![FIRST_EXPIRY_SECONDS]
        );
        assert_eq!(result.settled.len(), 3);
        assert_eq!(
            result
                .settled
                .iter()
                .filter(|settlement| settlement.settlement_price_cents == XRC_BUCKET_PRICE_CENTS)
                .count(),
            3
        );
    }

    /// Given: two same-amount settlement transfers sharing the same timestamp and accounts
    /// When: both settlements execute through the ledger
    /// Then: their ledger memos differ so ledger duplicate detection cannot collapse them
    #[tokio::test]
    async fn test_settlement_transfers_use_operation_specific_memos() {
        // given
        const FIRST_OPTION_ID: u64 = 401;
        const SECOND_OPTION_ID: u64 = 402;
        const FIRST_BUYER_PAYOUT_TRANSFER_INDEX: usize = 0;
        const SECOND_BUYER_PAYOUT_TRANSFER_INDEX: usize = 2;

        let writer = test_principal(61);
        let buyer = test_principal(62);
        setup_clean_option_state(writer, buyer, TEST_QUANTITY_SATS * 2);
        insert_test_option(
            FIRST_OPTION_ID,
            writer,
            buyer,
            TEST_NOW_SECONDS.saturating_sub(1),
        );
        insert_test_option(
            SECOND_OPTION_ID,
            writer,
            buyer,
            TEST_NOW_SECONDS.saturating_sub(1),
        );
        let (ledger_client, recorded_transfers) = RecordingTransferLedger::new();
        ledger::set_ledger(Rc::new(ledger_client));

        // when
        settle_single_option(FIRST_OPTION_ID, TEST_SETTLEMENT_PRICE_CENTS)
            .await
            .expect("first settlement should succeed");
        settle_single_option(SECOND_OPTION_ID, TEST_SETTLEMENT_PRICE_CENTS)
            .await
            .expect("second settlement should succeed");

        // then
        let transfers = recorded_transfers.borrow();
        let first_buyer_payout = &transfers[FIRST_BUYER_PAYOUT_TRANSFER_INDEX];
        let second_buyer_payout = &transfers[SECOND_BUYER_PAYOUT_TRANSFER_INDEX];

        assert_eq!(
            first_buyer_payout.from_subaccount,
            second_buyer_payout.from_subaccount
        );
        assert_eq!(first_buyer_payout.to, second_buyer_payout.to);
        assert_eq!(
            first_buyer_payout.amount_sats,
            second_buyer_payout.amount_sats
        );
        assert_eq!(
            first_buyer_payout.created_at_time_ns,
            second_buyer_payout.created_at_time_ns
        );
        assert!(first_buyer_payout.memo.is_some());
        assert_ne!(first_buyer_payout.memo, second_buyer_payout.memo);
    }

    /// Given: settlement completed buyer transfer and balance release, then hit a retryable fee transfer failure
    /// When: run_settlement_wal is retried with the same payload
    /// Then: retry resumes without double-crediting balances and settles exactly once
    #[tokio::test]
    async fn test_run_settlement_wal_retry_after_fee_transfer_failure_keeps_accounting_consistent()
    {
        // given
        let writer = test_principal(11);
        let buyer = test_principal(12);
        let retryable_ledger = Rc::new(RetryableProfitFeeTransferLedger::new());
        setup_test_state_with_ledger(writer, buyer, retryable_ledger.clone());
        let platform_fees_before = get_platform_fees_collected();
        let prepared_settlement_execution =
            prepare_settlement_execution(TEST_OPTION_ID, TEST_SETTLEMENT_PRICE_CENTS)
                .expect("settlement should be prepared");
        let wal_entry = get_entry(prepared_settlement_execution.operation_id)
            .expect("settlement wal entry should exist");
        let WalPayload::Settlement(settlement_payload) = wal_entry.payload else {
            panic!("settlement WAL entry should contain settlement payload");
        };

        // when
        let first_attempt_result = run_settlement_wal(
            prepared_settlement_execution.operation_id,
            &settlement_payload,
        )
        .await;
        let running_total_after_first_attempt =
            settlement_replay_running_total_sats(writer, buyer, platform_fees_before);
        let second_attempt_result = run_settlement_wal(
            prepared_settlement_execution.operation_id,
            &settlement_payload,
        )
        .await;

        // then
        assert!(matches!(
            first_attempt_result,
            Err(WalExecutionError::Retryable(_))
        ));
        assert_eq!(running_total_after_first_attempt, TEST_QUANTITY_SATS);
        assert_eq!(
            second_attempt_result,
            Ok(SettlementWalResult {
                option_id: TEST_OPTION_ID
            })
        );

        let writer_balance = get_balance(&writer);
        let buyer_balance = get_balance(&buyer);
        let option = get_active_option(TEST_OPTION_ID).expect("option should remain in storage");

        const EXPECTED_GROSS_BUYER_PAYOUT_SATS: u64 = 125_000;
        const EXPECTED_PROFIT_FEE_SATS: u64 = 12_500;
        const EXPECTED_BUYER_PAYOUT_SATS: u64 =
            EXPECTED_GROSS_BUYER_PAYOUT_SATS - EXPECTED_PROFIT_FEE_SATS;
        const EXPECTED_TRANSFER_CALL_COUNT: u64 = 3;

        assert_eq!(buyer_balance.available, EXPECTED_BUYER_PAYOUT_SATS);
        assert_eq!(buyer_balance.locked_as_writer, 0);
        assert_eq!(
            writer_balance.available,
            EXPECTED_EFFECTIVE_WRITER_PAYOUT_SATS
        );
        assert_eq!(writer_balance.locked_as_writer, 0);
        assert_eq!(option.status, ActiveOptionStatus::Settled);
        assert!(
            get_settlement(TEST_OPTION_ID).is_none(),
            "settlement journal should be removed after success"
        );
        assert_eq!(
            retryable_ledger.transfer_call_count(),
            EXPECTED_TRANSFER_CALL_COUNT
        );
        assert_eq!(
            get_platform_fees_collected() - platform_fees_before,
            EXPECTED_PROFIT_FEE_SATS
        );
        assert_eq!(
            settlement_replay_running_total_sats(writer, buyer, platform_fees_before),
            TEST_QUANTITY_SATS - EXPECTED_SETTLEMENT_TRANSFER_FEES_SATS
        );
    }

    /// Given: settlement retries always fail at the first buyer transfer step
    /// When: run_settlement_wal is executed repeatedly with the same payload
    /// Then: balances stay unchanged across retries and no partial accounting effects leak
    #[tokio::test]
    async fn test_run_settlement_wal_repeated_buyer_transfer_failures_are_balance_safe() {
        // given
        let writer = test_principal(21);
        let buyer = test_principal(22);
        setup_test_state(writer, buyer);
        let prepared_settlement_execution =
            prepare_settlement_execution(TEST_OPTION_ID, TEST_SETTLEMENT_PRICE_CENTS)
                .expect("settlement should be prepared");
        let wal_entry = get_entry(prepared_settlement_execution.operation_id)
            .expect("settlement wal entry should exist");
        let WalPayload::Settlement(settlement_payload) = wal_entry.payload else {
            panic!("settlement WAL entry should contain settlement payload");
        };

        // when
        let first_attempt_result = run_settlement_wal(
            prepared_settlement_execution.operation_id,
            &settlement_payload,
        )
        .await;
        let second_attempt_result = run_settlement_wal(
            prepared_settlement_execution.operation_id,
            &settlement_payload,
        )
        .await;

        // then
        assert!(matches!(
            first_attempt_result,
            Err(WalExecutionError::Retryable(_))
        ));
        assert!(matches!(
            second_attempt_result,
            Err(WalExecutionError::Retryable(_))
        ));

        let writer_balance = get_balance(&writer);
        let buyer_balance = get_balance(&buyer);
        let option = get_active_option(TEST_OPTION_ID).expect("option should remain in storage");
        let settlement = get_settlement(TEST_OPTION_ID).expect("settlement should remain pending");

        assert_eq!(writer_balance.available, 0);
        assert_eq!(writer_balance.locked_as_writer, TEST_QUANTITY_SATS);
        assert_eq!(buyer_balance.available, 0);
        assert_eq!(buyer_balance.locked_as_writer, 0);
        assert_eq!(option.status, ActiveOptionStatus::Settling);
        assert_eq!(settlement.phase, SettlementPhase::Started);
    }

    /// Given: a settlement needs to collect a profit fee from writer collateral
    /// When: the profit-fee transfer is in progress and the writer attempts to spend that fee
    /// Then: the fee never becomes available to the writer before settlement accounting completes
    #[tokio::test]
    async fn test_profit_fee_collateral_is_not_writer_spendable_during_fee_transfer() {
        // given
        let writer = test_principal(25);
        let buyer = test_principal(26);
        let writer_spend_succeeded = Rc::new(Cell::new(false));
        let ledger = WriterSpendDuringProfitFeeTransferLedger {
            writer,
            transfer_call_count: RefCell::new(0),
            writer_spend_succeeded: Rc::clone(&writer_spend_succeeded),
        };
        setup_test_state_with_ledger(writer, buyer, Rc::new(ledger));
        let platform_fees_before = get_platform_fees_collected();
        let prepared_settlement_execution =
            prepare_settlement_execution(TEST_OPTION_ID, TEST_SETTLEMENT_PRICE_CENTS)
                .expect("settlement should be prepared");
        let wal_entry = get_entry(prepared_settlement_execution.operation_id)
            .expect("settlement wal entry should exist");
        let WalPayload::Settlement(settlement_payload) = wal_entry.payload else {
            panic!("settlement WAL entry should contain settlement payload");
        };

        // when
        let settlement_result = run_settlement_wal(
            prepared_settlement_execution.operation_id,
            &settlement_payload,
        )
        .await;

        // then
        assert_eq!(
            settlement_result,
            Ok(SettlementWalResult {
                option_id: TEST_OPTION_ID
            })
        );
        assert!(!writer_spend_succeeded.get());

        let writer_balance = get_balance(&writer);
        let buyer_balance = get_balance(&buyer);
        assert_eq!(
            writer_balance.available,
            EXPECTED_EFFECTIVE_WRITER_PAYOUT_SATS
        );
        assert_eq!(writer_balance.locked_as_writer, 0);
        assert_eq!(buyer_balance.available, EXPECTED_BUYER_PAYOUT_SATS);
        assert_eq!(buyer_balance.locked_as_writer, 0);
        assert_eq!(
            get_platform_fees_collected() - platform_fees_before,
            EXPECTED_PROFIT_FEE_SATS
        );
    }

    /// Given: settlement retries fail at the buyer payout ledger transfer
    /// When: run_settlement_wal is retried with the same operation id and payload
    /// Then: each failed transfer attempt uses the same deterministic buyer payout memo
    #[tokio::test]
    async fn test_run_settlement_wal_reuses_buyer_payout_memo_across_retries() {
        // given
        let writer = test_principal(23);
        let buyer = test_principal(24);
        let (recording_ledger, transfer_memos) = AlwaysFailingRecordingTransferLedger::new();
        setup_test_state_with_ledger(writer, buyer, Rc::new(recording_ledger));
        let prepared_settlement_execution =
            prepare_settlement_execution(TEST_OPTION_ID, TEST_SETTLEMENT_PRICE_CENTS)
                .expect("settlement should be prepared");
        let wal_entry = get_entry(prepared_settlement_execution.operation_id)
            .expect("settlement wal entry should exist");
        let WalPayload::Settlement(settlement_payload) = wal_entry.payload else {
            panic!("settlement WAL entry should contain settlement payload");
        };

        // when
        let first_attempt_result = run_settlement_wal(
            prepared_settlement_execution.operation_id,
            &settlement_payload,
        )
        .await;
        let second_attempt_result = run_settlement_wal(
            prepared_settlement_execution.operation_id,
            &settlement_payload,
        )
        .await;

        // then
        assert!(matches!(
            first_attempt_result,
            Err(WalExecutionError::Retryable(_))
        ));
        assert!(matches!(
            second_attempt_result,
            Err(WalExecutionError::Retryable(_))
        ));

        let expected_buyer_payout_memo = ledger_memo(
            prepared_settlement_execution.operation_id,
            LedgerMemoKind::SettlementBuyerPayout,
            &[],
        );
        assert_eq!(
            *transfer_memos.borrow(),
            vec![
                Some(expected_buyer_payout_memo.clone()),
                Some(expected_buyer_payout_memo)
            ]
        );
    }

    const SETTLEMENT_TRANSFER_COUNT: u64 = 2;
    const EXPECTED_SETTLEMENT_TRANSFER_FEES_SATS: u64 = SETTLEMENT_TRANSFER_COUNT * 10;
    const EXPECTED_EFFECTIVE_WRITER_PAYOUT_SATS: u64 =
        EXPECTED_WRITER_PAYOUT_SATS - EXPECTED_SETTLEMENT_TRANSFER_FEES_SATS;

    struct FeeAwareMockLedger {
        canister_self: Principal,
        balances: RefCell<BTreeMap<Account, u64>>,
        transfer_fee_sats: u64,
    }

    #[derive(Clone, Copy, PartialEq, Eq)]
    enum TrapAfterCommittedTransfer {
        None,
        BuyerPayout,
        ProfitFee,
    }

    struct ReplayAwareSettlementLedger {
        canister_self: Principal,
        balances: RefCell<BTreeMap<Account, u64>>,
        seen_transfer_keys: RefCell<BTreeSet<(u64, String)>>,
        transfer_call_count: RefCell<u64>,
        economic_transfer_count: RefCell<u64>,
        trap_after_committed_transfer: TrapAfterCommittedTransfer,
        did_trap_after_committed_transfer: RefCell<bool>,
        transfer_fee_sats: u64,
    }

    impl FeeAwareMockLedger {
        fn new(canister_self: Principal, transfer_fee_sats: u64) -> Self {
            Self {
                canister_self,
                balances: RefCell::new(BTreeMap::new()),
                transfer_fee_sats,
            }
        }

        fn set_balance(&self, account: Account, balance: u64) {
            self.balances.borrow_mut().insert(account, balance);
        }

        fn balance_of_account(&self, account: &Account) -> u64 {
            self.balances.borrow().get(account).copied().unwrap_or(0)
        }
    }

    impl ReplayAwareSettlementLedger {
        fn new(
            canister_self: Principal,
            transfer_fee_sats: u64,
            trap_after_committed_transfer: TrapAfterCommittedTransfer,
        ) -> Self {
            Self {
                canister_self,
                balances: RefCell::new(BTreeMap::new()),
                seen_transfer_keys: RefCell::new(BTreeSet::new()),
                transfer_call_count: RefCell::new(0),
                economic_transfer_count: RefCell::new(0),
                trap_after_committed_transfer,
                did_trap_after_committed_transfer: RefCell::new(false),
                transfer_fee_sats,
            }
        }

        fn set_balance(&self, account: Account, balance: u64) {
            self.balances.borrow_mut().insert(account, balance);
        }

        fn balance_of_account(&self, account: &Account) -> u64 {
            self.balances.borrow().get(account).copied().unwrap_or(0)
        }

        fn transfer_call_count(&self) -> u64 {
            *self.transfer_call_count.borrow()
        }

        fn economic_transfer_count(&self) -> u64 {
            *self.economic_transfer_count.borrow()
        }

        fn should_trap_after_committed_transfer(&self, amount: u64) -> bool {
            if *self.did_trap_after_committed_transfer.borrow() {
                return false;
            }

            match self.trap_after_committed_transfer {
                TrapAfterCommittedTransfer::None => false,
                TrapAfterCommittedTransfer::BuyerPayout => amount == EXPECTED_BUYER_PAYOUT_SATS,
                TrapAfterCommittedTransfer::ProfitFee => amount == EXPECTED_PROFIT_FEE_SATS,
            }
        }
    }

    #[async_trait(?Send)]
    impl LedgerClient for FeeAwareMockLedger {
        async fn icrc1_transfer(
            &self,
            from_subaccount: Option<[u8; 32]>,
            to: Account,
            amount: u64,
            _created_at_time: u64,
            _memo: Option<Memo>,
        ) -> Result<u64, VolumetricError> {
            let from = Account {
                owner: self.canister_self,
                subaccount: from_subaccount,
            };
            let total_debit = amount.saturating_add(self.transfer_fee_sats);
            let mut balances = self.balances.borrow_mut();
            let from_balance = balances.get(&from).copied().unwrap_or(0);
            if from_balance < total_debit {
                return Err(VolumetricError::from_def(
                    error_codes::INTER_CANISTER_CALL_FAILED,
                    Some("insufficient funds in mock ledger"),
                    None,
                ));
            }
            balances.insert(from, from_balance - total_debit);
            *balances.entry(to).or_insert(0) += amount;
            Ok(1)
        }

        async fn icrc1_balance_of(&self, account: Account) -> Result<Nat, VolumetricError> {
            Ok(Nat::from(
                self.balances.borrow().get(&account).copied().unwrap_or(0),
            ))
        }

        async fn icrc2_approve(&self, _args: ApproveArgs) -> Result<Nat, VolumetricError> {
            Ok(Nat::from(0u64))
        }

        async fn icrc1_fee(&self) -> Result<u64, VolumetricError> {
            Ok(self.transfer_fee_sats)
        }
    }

    #[async_trait(?Send)]
    impl LedgerClient for ReplayAwareSettlementLedger {
        async fn icrc1_transfer(
            &self,
            from_subaccount: Option<[u8; 32]>,
            to: Account,
            amount: u64,
            created_at_time: u64,
            memo: Option<Memo>,
        ) -> Result<u64, VolumetricError> {
            let next_transfer_call_count = self.transfer_call_count().saturating_add(1);
            *self.transfer_call_count.borrow_mut() = next_transfer_call_count;

            let transfer_key = (created_at_time, format!("{memo:?}"));
            if !self.seen_transfer_keys.borrow_mut().insert(transfer_key) {
                return Ok(self.economic_transfer_count());
            }

            let from = Account {
                owner: self.canister_self,
                subaccount: from_subaccount,
            };
            let total_debit = amount.saturating_add(self.transfer_fee_sats);
            {
                let mut balances = self.balances.borrow_mut();
                let from_balance = balances.get(&from).copied().unwrap_or(0);
                if from_balance < total_debit {
                    return Err(VolumetricError::from_def(
                        error_codes::INTER_CANISTER_CALL_FAILED,
                        Some("insufficient funds in mock ledger"),
                        None,
                    ));
                }
                balances.insert(from, from_balance - total_debit);
                *balances.entry(to).or_insert(0) += amount;
            }

            let next_economic_transfer_count = self.economic_transfer_count().saturating_add(1);
            *self.economic_transfer_count.borrow_mut() = next_economic_transfer_count;

            if self.should_trap_after_committed_transfer(amount) {
                *self.did_trap_after_committed_transfer.borrow_mut() = true;
                panic!("simulated callback trap after committed settlement transfer");
            }

            Ok(self.economic_transfer_count())
        }

        async fn icrc1_balance_of(&self, account: Account) -> Result<Nat, VolumetricError> {
            Ok(Nat::from(self.balance_of_account(&account)))
        }

        async fn icrc2_approve(&self, _args: ApproveArgs) -> Result<Nat, VolumetricError> {
            Ok(Nat::from(0u64))
        }

        async fn icrc1_fee(&self) -> Result<u64, VolumetricError> {
            Ok(self.transfer_fee_sats)
        }
    }

    fn settlement_replay_running_total_sats(
        writer: Principal,
        buyer: Principal,
        platform_fees_before: u64,
    ) -> u64 {
        let writer_balance = get_balance(&writer);
        let buyer_balance = get_balance(&buyer);
        let platform_fee_delta = get_platform_fees_collected().saturating_sub(platform_fees_before);

        writer_balance
            .total()
            .saturating_add(buyer_balance.total())
            .saturating_add(platform_fee_delta)
    }

    fn prepare_standard_settlement_wal_payload() -> (OperationId, SettlementWalPayload) {
        let prepared_settlement_execution =
            prepare_settlement_execution(TEST_OPTION_ID, TEST_SETTLEMENT_PRICE_CENTS)
                .expect("settlement should be prepared");
        let wal_entry = get_entry(prepared_settlement_execution.operation_id)
            .expect("settlement WAL entry should exist");
        let WalPayload::Settlement(settlement_payload) = wal_entry.payload else {
            panic!("settlement WAL entry should contain settlement payload");
        };

        (
            prepared_settlement_execution.operation_id,
            settlement_payload,
        )
    }

    fn account_for_test_subaccount(owner: Principal, principal: Principal) -> Account {
        Account {
            owner,
            subaccount: Some(derive_subaccount(principal)),
        }
    }

    fn fee_recipient_account() -> Account {
        Account {
            owner: get_fee_recipient(),
            subaccount: None,
        }
    }

    fn seed_replay_ledger_after_buyer_payout(
        ledger: &ReplayAwareSettlementLedger,
        canister_self: Principal,
        writer: Principal,
        buyer: Principal,
        transfer_fee_sats: u64,
    ) {
        ledger.set_balance(
            account_for_test_subaccount(canister_self, writer),
            TEST_QUANTITY_SATS
                .saturating_sub(EXPECTED_BUYER_PAYOUT_SATS)
                .saturating_sub(transfer_fee_sats),
        );
        ledger.set_balance(
            account_for_test_subaccount(canister_self, buyer),
            EXPECTED_BUYER_PAYOUT_SATS,
        );
    }

    fn seed_replay_ledger_after_profit_fee(
        ledger: &ReplayAwareSettlementLedger,
        canister_self: Principal,
        writer: Principal,
        buyer: Principal,
        transfer_fee_sats: u64,
    ) {
        seed_replay_ledger_after_buyer_payout(
            ledger,
            canister_self,
            writer,
            buyer,
            transfer_fee_sats,
        );
        ledger.set_balance(
            account_for_test_subaccount(canister_self, writer),
            EXPECTED_EFFECTIVE_WRITER_PAYOUT_SATS,
        );
        ledger.set_balance(fee_recipient_account(), EXPECTED_PROFIT_FEE_SATS);
    }

    fn assert_standard_replay_balances(
        writer: Principal,
        buyer: Principal,
        platform_fees_before: u64,
    ) {
        let writer_balance = get_balance(&writer);
        let buyer_balance = get_balance(&buyer);

        assert_eq!(buyer_balance.available, EXPECTED_BUYER_PAYOUT_SATS);
        assert_eq!(buyer_balance.locked_as_writer, 0);
        assert_eq!(
            writer_balance.available,
            EXPECTED_EFFECTIVE_WRITER_PAYOUT_SATS
        );
        assert_eq!(writer_balance.locked_as_writer, 0);
        assert_eq!(
            get_platform_fees_collected().saturating_sub(platform_fees_before),
            EXPECTED_PROFIT_FEE_SATS
        );
        assert_eq!(
            settlement_replay_running_total_sats(writer, buyer, platform_fees_before),
            TEST_QUANTITY_SATS.saturating_sub(EXPECTED_SETTLEMENT_TRANSFER_FEES_SATS)
        );
    }

    /// Given: buyer payout commits on the ledger but the callback traps before TransferComplete
    /// When: stale InFlight settlement WAL is replayed
    /// Then: buyer payout is not double-spent and internal balances settle once
    #[test]
    fn test_settlement_wal_replay_after_committed_buyer_payout_preserves_balances() {
        // given
        const EXPECTED_TRANSFER_FEE_SATS: u64 = 10;
        const EXPECTED_TRANSFER_CALL_COUNT: u64 = 3;
        let writer = test_principal(87);
        let buyer = test_principal(88);
        let canister_self = Principal::anonymous();
        let writer_account = account_for_test_subaccount(canister_self, writer);
        let buyer_account = account_for_test_subaccount(canister_self, buyer);
        let replay_ledger = Rc::new(ReplayAwareSettlementLedger::new(
            canister_self,
            EXPECTED_TRANSFER_FEE_SATS,
            TrapAfterCommittedTransfer::BuyerPayout,
        ));
        replay_ledger.set_balance(writer_account, TEST_QUANTITY_SATS);
        setup_test_state_with_ledger(writer, buyer, replay_ledger.clone());
        set_cached_transfer_fee_for_testing(EXPECTED_TRANSFER_FEE_SATS, TEST_NOW_SECONDS);
        let platform_fees_before = get_platform_fees_collected();
        let (operation_id, _) = prepare_standard_settlement_wal_payload();

        // when
        let first_attempt = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            let _ = execute_wal_entry_now_blocking(operation_id);
        }));
        assert!(first_attempt.is_err(), "first attempt should trap");

        let wal_entry_after_trap = get_entry(operation_id).expect("wal entry should exist");
        let settlement_after_trap =
            get_settlement(TEST_OPTION_ID).expect("settlement should remain pending");
        const SIXTEEN_MINUTES_NS: u64 = 16 * 60 * 1_000_000_000;
        ic::set_runtime(Box::new(RuntimeAt {
            now_ns: TEST_NOW_NS.saturating_add(SIXTEEN_MINUTES_NS),
        }));
        let promoted_count = crate::journaling::promote_stale_in_flight_to_recovery_required();
        let replay_outcome = execute_wal_entry_now_blocking(operation_id);

        // then
        assert_eq!(wal_entry_after_trap.status, WalStatus::InFlight);
        assert_eq!(settlement_after_trap.phase, SettlementPhase::Started);
        assert_eq!(promoted_count, 1);
        assert_eq!(replay_outcome, WalExecutionOutcome::Succeeded);
        assert_standard_replay_balances(writer, buyer, platform_fees_before);
        assert_eq!(
            replay_ledger.transfer_call_count(),
            EXPECTED_TRANSFER_CALL_COUNT
        );
        assert_eq!(
            replay_ledger.economic_transfer_count(),
            SETTLEMENT_TRANSFER_COUNT
        );
        assert_eq!(
            replay_ledger.balance_of_account(&buyer_account),
            EXPECTED_BUYER_PAYOUT_SATS
        );
        assert_eq!(
            replay_ledger.balance_of_account(&fee_recipient_account()),
            EXPECTED_PROFIT_FEE_SATS
        );
        assert_eq!(
            get_balance(&writer).total(),
            replay_ledger.balance_of_account(&writer_account)
        );
        assert!(get_settlement(TEST_OPTION_ID).is_none());
    }

    /// Given: buyer payout reached TransferComplete but internal balance release has not run
    /// When: settlement WAL resumes from TransferComplete
    /// Then: locked collateral is released to the buyer exactly once
    #[tokio::test]
    async fn test_settlement_wal_replay_from_transfer_complete_releases_buyer_once() {
        // given
        const EXPECTED_TRANSFER_FEE_SATS: u64 = 10;
        let writer = test_principal(89);
        let buyer = test_principal(90);
        let canister_self = Principal::anonymous();
        let writer_account = account_for_test_subaccount(canister_self, writer);
        let replay_ledger = Rc::new(ReplayAwareSettlementLedger::new(
            canister_self,
            EXPECTED_TRANSFER_FEE_SATS,
            TrapAfterCommittedTransfer::None,
        ));
        seed_replay_ledger_after_buyer_payout(
            &replay_ledger,
            canister_self,
            writer,
            buyer,
            EXPECTED_TRANSFER_FEE_SATS,
        );
        setup_test_state_with_ledger(writer, buyer, replay_ledger.clone());
        set_cached_transfer_fee_for_testing(EXPECTED_TRANSFER_FEE_SATS, TEST_NOW_SECONDS);
        let platform_fees_before = get_platform_fees_collected();
        let (operation_id, settlement_payload) = prepare_standard_settlement_wal_payload();
        update_settlement_phase(TEST_OPTION_ID, SettlementPhase::TransferComplete);

        // when
        let settlement_result = run_settlement_wal(operation_id, &settlement_payload).await;

        // then
        assert_eq!(
            settlement_result,
            Ok(SettlementWalResult {
                option_id: TEST_OPTION_ID
            })
        );
        assert_standard_replay_balances(writer, buyer, platform_fees_before);
        assert_eq!(replay_ledger.transfer_call_count(), 1);
        assert_eq!(replay_ledger.economic_transfer_count(), 1);
        assert_eq!(
            get_balance(&writer).total(),
            replay_ledger.balance_of_account(&writer_account)
        );
    }

    /// Given: internal buyer release completed and profit-fee transfer is unavailable
    /// When: settlement WAL resumes from BalanceReleased
    /// Then: buyer credit and writer locks are preserved without counting platform fees
    #[tokio::test]
    async fn test_settlement_wal_replay_from_balance_released_preserves_state_on_fee_retry() {
        // given
        const EXPECTED_TRANSFER_FEE_SATS: u64 = 10;
        let writer = test_principal(91);
        let buyer = test_principal(92);
        let failing_ledger = Rc::new(FailingBuyerTransferLedger);
        setup_test_state_with_ledger(writer, buyer, failing_ledger);
        set_cached_transfer_fee_for_testing(EXPECTED_TRANSFER_FEE_SATS, TEST_NOW_SECONDS);
        let platform_fees_before = get_platform_fees_collected();
        let (operation_id, settlement_payload) = prepare_standard_settlement_wal_payload();
        release_locked_to_buyer(writer, buyer, EXPECTED_BUYER_PAYOUT_SATS)
            .expect("buyer release should succeed");
        update_settlement_phase(TEST_OPTION_ID, SettlementPhase::BalanceReleased);

        // when
        let settlement_result = run_settlement_wal(operation_id, &settlement_payload).await;

        // then
        assert!(matches!(
            settlement_result,
            Err(WalExecutionError::Retryable(_))
        ));
        let writer_balance = get_balance(&writer);
        let buyer_balance = get_balance(&buyer);
        let settlement = get_settlement(TEST_OPTION_ID).expect("settlement should remain pending");
        assert_eq!(writer_balance.available, 0);
        assert_eq!(
            writer_balance.locked_as_writer,
            TEST_QUANTITY_SATS - EXPECTED_BUYER_PAYOUT_SATS
        );
        assert_eq!(buyer_balance.available, EXPECTED_BUYER_PAYOUT_SATS);
        assert_eq!(buyer_balance.locked_as_writer, 0);
        assert_eq!(
            get_platform_fees_collected().saturating_sub(platform_fees_before),
            0
        );
        assert_eq!(settlement.phase, SettlementPhase::BalanceReleased);
        assert_eq!(
            settlement_replay_running_total_sats(writer, buyer, platform_fees_before),
            TEST_QUANTITY_SATS
        );
    }

    /// Given: profit-fee accounting reached ProfitFeeCollected but writer payout unlock has not run
    /// When: settlement WAL resumes from ProfitFeeCollected
    /// Then: platform fees are not double-counted and writer payout unlocks once
    #[tokio::test]
    async fn test_settlement_wal_replay_from_profit_fee_collected_unlocks_writer_once() {
        // given
        const EXPECTED_TRANSFER_FEE_SATS: u64 = 10;
        let writer = test_principal(93);
        let buyer = test_principal(94);
        let canister_self = Principal::anonymous();
        let writer_account = account_for_test_subaccount(canister_self, writer);
        let replay_ledger = Rc::new(ReplayAwareSettlementLedger::new(
            canister_self,
            EXPECTED_TRANSFER_FEE_SATS,
            TrapAfterCommittedTransfer::None,
        ));
        seed_replay_ledger_after_profit_fee(
            &replay_ledger,
            canister_self,
            writer,
            buyer,
            EXPECTED_TRANSFER_FEE_SATS,
        );
        setup_test_state_with_ledger(writer, buyer, replay_ledger.clone());
        set_cached_transfer_fee_for_testing(EXPECTED_TRANSFER_FEE_SATS, TEST_NOW_SECONDS);
        let platform_fees_before = get_platform_fees_collected();
        let (operation_id, settlement_payload) = prepare_standard_settlement_wal_payload();
        release_locked_to_buyer(writer, buyer, EXPECTED_BUYER_PAYOUT_SATS)
            .expect("buyer release should succeed");
        add_platform_fee(EXPECTED_PROFIT_FEE_SATS);
        deduct_locked_collateral(writer, EXPECTED_PROFIT_FEE_SATS)
            .expect("profit fee deduction should succeed");
        deduct_writer_transfer_fees(writer, EXPECTED_SETTLEMENT_TRANSFER_FEES_SATS)
            .expect("transfer fee deduction should succeed");
        update_settlement_phase(TEST_OPTION_ID, SettlementPhase::ProfitFeeCollected);

        // when
        let settlement_result = run_settlement_wal(operation_id, &settlement_payload).await;

        // then
        assert_eq!(
            settlement_result,
            Ok(SettlementWalResult {
                option_id: TEST_OPTION_ID
            })
        );
        assert_standard_replay_balances(writer, buyer, platform_fees_before);
        assert_eq!(replay_ledger.transfer_call_count(), 0);
        assert_eq!(replay_ledger.economic_transfer_count(), 0);
        assert_eq!(
            get_balance(&writer).total(),
            replay_ledger.balance_of_account(&writer_account)
        );
    }

    /// Given: writer payout is already released and only finalization remains
    /// When: settlement WAL resumes from WriterPayoutReleased
    /// Then: finalization removes the journal without touching balances or ledger
    #[tokio::test]
    async fn test_settlement_wal_replay_from_writer_payout_released_finalizes_once() {
        // given
        const EXPECTED_TRANSFER_FEE_SATS: u64 = 10;
        let writer = test_principal(95);
        let buyer = test_principal(96);
        let canister_self = Principal::anonymous();
        let replay_ledger = Rc::new(ReplayAwareSettlementLedger::new(
            canister_self,
            EXPECTED_TRANSFER_FEE_SATS,
            TrapAfterCommittedTransfer::None,
        ));
        seed_replay_ledger_after_profit_fee(
            &replay_ledger,
            canister_self,
            writer,
            buyer,
            EXPECTED_TRANSFER_FEE_SATS,
        );
        setup_test_state_with_ledger(writer, buyer, replay_ledger.clone());
        set_cached_transfer_fee_for_testing(EXPECTED_TRANSFER_FEE_SATS, TEST_NOW_SECONDS);
        let platform_fees_before = get_platform_fees_collected();
        let (operation_id, settlement_payload) = prepare_standard_settlement_wal_payload();
        set_balance(
            writer,
            UserBalance {
                available: EXPECTED_EFFECTIVE_WRITER_PAYOUT_SATS,
                locked_as_writer: 0,
            },
        );
        set_balance(
            buyer,
            UserBalance {
                available: EXPECTED_BUYER_PAYOUT_SATS,
                locked_as_writer: 0,
            },
        );
        add_platform_fee(EXPECTED_PROFIT_FEE_SATS);
        update_settlement_phase(TEST_OPTION_ID, SettlementPhase::WriterPayoutReleased);

        // when
        let settlement_result = run_settlement_wal(operation_id, &settlement_payload).await;

        // then
        assert_eq!(
            settlement_result,
            Ok(SettlementWalResult {
                option_id: TEST_OPTION_ID
            })
        );
        assert_standard_replay_balances(writer, buyer, platform_fees_before);
        assert_eq!(replay_ledger.transfer_call_count(), 0);
        assert_eq!(replay_ledger.economic_transfer_count(), 0);
        assert!(get_settlement(TEST_OPTION_ID).is_none());
        let option = get_active_option(TEST_OPTION_ID).expect("option should remain in storage");
        assert_eq!(option.status, ActiveOptionStatus::Settled);
    }

    /// Given: settlement has already succeeded through WAL execution
    /// When: the same WAL payload is executed again
    /// Then: terminal Settled state is a no-op for balances, fees, and ledger transfers
    #[tokio::test]
    async fn test_settlement_wal_replay_after_terminal_settled_is_noop() {
        // given
        const EXPECTED_TRANSFER_FEE_SATS: u64 = 10;
        let writer = test_principal(97);
        let buyer = test_principal(98);
        let canister_self = Principal::anonymous();
        let replay_ledger = Rc::new(ReplayAwareSettlementLedger::new(
            canister_self,
            EXPECTED_TRANSFER_FEE_SATS,
            TrapAfterCommittedTransfer::None,
        ));
        replay_ledger.set_balance(
            account_for_test_subaccount(canister_self, writer),
            TEST_QUANTITY_SATS,
        );
        setup_test_state_with_ledger(writer, buyer, replay_ledger.clone());
        set_cached_transfer_fee_for_testing(EXPECTED_TRANSFER_FEE_SATS, TEST_NOW_SECONDS);
        let platform_fees_before = get_platform_fees_collected();
        let (operation_id, settlement_payload) = prepare_standard_settlement_wal_payload();
        let first_result = run_settlement_wal(operation_id, &settlement_payload)
            .await
            .expect("first WAL execution should settle");
        let writer_balance_after_first = get_balance(&writer);
        let buyer_balance_after_first = get_balance(&buyer);
        let platform_fee_delta_after_first =
            get_platform_fees_collected().saturating_sub(platform_fees_before);
        let transfer_call_count_after_first = replay_ledger.transfer_call_count();
        let economic_transfer_count_after_first = replay_ledger.economic_transfer_count();

        // when
        let second_result = run_settlement_wal(operation_id, &settlement_payload).await;

        // then
        assert_eq!(
            first_result,
            SettlementWalResult {
                option_id: TEST_OPTION_ID
            }
        );
        assert_eq!(
            second_result,
            Ok(SettlementWalResult {
                option_id: TEST_OPTION_ID
            })
        );
        assert_eq!(
            get_balance(&writer).available,
            writer_balance_after_first.available
        );
        assert_eq!(
            get_balance(&writer).locked_as_writer,
            writer_balance_after_first.locked_as_writer
        );
        assert_eq!(
            get_balance(&buyer).available,
            buyer_balance_after_first.available
        );
        assert_eq!(
            get_balance(&buyer).locked_as_writer,
            buyer_balance_after_first.locked_as_writer
        );
        assert_eq!(
            get_platform_fees_collected().saturating_sub(platform_fees_before),
            platform_fee_delta_after_first
        );
        assert_eq!(
            replay_ledger.transfer_call_count(),
            transfer_call_count_after_first
        );
        assert_eq!(
            replay_ledger.economic_transfer_count(),
            economic_transfer_count_after_first
        );
        assert!(get_settlement(TEST_OPTION_ID).is_none());
    }

    /// Given: a fee-aware mock ledger that deducts transfer fees from the sender's subaccount
    /// When: an ITM option settles, making two transfers from the writer's subaccount
    /// Then: the writer's internal balance matches the writer's ledger subaccount balance
    #[tokio::test]
    async fn test_settlement_writer_ledger_balance_accounts_for_transfer_fees() {
        // given
        const EXPECTED_TRANSFER_FEE_SATS: u64 = 10;
        let writer = test_principal(81);
        let buyer = test_principal(82);
        let canister_self = Principal::anonymous();
        let writer_subaccount = derive_subaccount(writer);

        let mock_ledger = Rc::new(FeeAwareMockLedger::new(
            canister_self,
            EXPECTED_TRANSFER_FEE_SATS,
        ));
        mock_ledger.set_balance(
            Account {
                owner: canister_self,
                subaccount: Some(writer_subaccount),
            },
            TEST_QUANTITY_SATS,
        );
        setup_test_state_with_ledger(writer, buyer, mock_ledger.clone());
        set_cached_transfer_fee_for_testing(EXPECTED_TRANSFER_FEE_SATS, TEST_NOW_SECONDS);

        // when
        let settlement_result =
            settle_single_option(TEST_OPTION_ID, TEST_SETTLEMENT_PRICE_CENTS).await;
        assert!(settlement_result.is_ok(), "settlement should succeed");

        // then
        let writer_internal = get_balance(&writer);
        let writer_internal_total = writer_internal.available + writer_internal.locked_as_writer;
        let writer_ledger_balance = mock_ledger.balance_of_account(&Account {
            owner: canister_self,
            subaccount: Some(writer_subaccount),
        });

        assert_eq!(
            writer_internal_total,
            writer_ledger_balance,
            "writer internal balance ({}) should match writer ledger subaccount balance ({}) \
             after {} transfers * {} sats fee",
            writer_internal_total,
            writer_ledger_balance,
            SETTLEMENT_TRANSFER_COUNT,
            EXPECTED_TRANSFER_FEE_SATS,
        );
    }

    /// Given: an extremely ITM option whose writer payout is smaller than settlement transfer fees
    /// When: the writer subaccount has enough total funds for the ledger transfers
    /// Then: settlement succeeds and internal accounting matches the writer ledger subaccount
    #[tokio::test]
    async fn test_extreme_itm_settlement_uses_available_balance_when_writer_payout_smaller_than_fees(
    ) {
        // given
        const EXPECTED_TRANSFER_FEE_SATS: u64 = 10;
        const EXTRA_WRITER_AVAILABLE_SATS: u64 = 100;
        const EXTREME_SETTLEMENT_PRICE_CENTS: u64 = 1_000_000_000_000;

        let writer = test_principal(83);
        let buyer = test_principal(84);
        let canister_self = Principal::anonymous();
        let writer_subaccount = derive_subaccount(writer);

        let mock_ledger = Rc::new(FeeAwareMockLedger::new(
            canister_self,
            EXPECTED_TRANSFER_FEE_SATS,
        ));
        mock_ledger.set_balance(
            Account {
                owner: canister_self,
                subaccount: Some(writer_subaccount),
            },
            TEST_QUANTITY_SATS + EXTRA_WRITER_AVAILABLE_SATS,
        );
        setup_test_state_with_ledger(writer, buyer, mock_ledger.clone());
        set_cached_transfer_fee_for_testing(EXPECTED_TRANSFER_FEE_SATS, TEST_NOW_SECONDS);
        set_balance(
            writer,
            UserBalance {
                available: EXTRA_WRITER_AVAILABLE_SATS,
                locked_as_writer: TEST_QUANTITY_SATS,
            },
        );

        // when
        let settlement_result =
            settle_single_option(TEST_OPTION_ID, EXTREME_SETTLEMENT_PRICE_CENTS).await;

        // then
        assert!(
            settlement_result.is_ok(),
            "settlement should use writer available balance to cover transfer fees"
        );

        let writer_internal = get_balance(&writer);
        let writer_internal_total = writer_internal.available + writer_internal.locked_as_writer;
        let writer_ledger_balance = mock_ledger.balance_of_account(&Account {
            owner: canister_self,
            subaccount: Some(writer_subaccount),
        });

        assert_eq!(writer_internal_total, writer_ledger_balance);
    }

    /// Given: settlement traps after the profit-fee ledger transfer commits but before internal accounting
    /// When: the stale WAL is promoted and replayed
    /// Then: duplicate ledger detection prevents a double spend and all internal sums settle once
    #[test]
    fn test_settlement_replay_after_committed_profit_fee_transfer_preserves_balances() {
        // given
        const EXPECTED_TRANSFER_FEE_SATS: u64 = 10;
        const EXPECTED_TRANSFER_CALL_COUNT: u64 = 3;
        let writer = test_principal(85);
        let buyer = test_principal(86);
        let canister_self = Principal::anonymous();
        let writer_subaccount = derive_subaccount(writer);
        let buyer_subaccount = derive_subaccount(buyer);

        let mock_ledger = Rc::new(ReplayAwareSettlementLedger::new(
            canister_self,
            EXPECTED_TRANSFER_FEE_SATS,
            TrapAfterCommittedTransfer::ProfitFee,
        ));
        let writer_account = Account {
            owner: canister_self,
            subaccount: Some(writer_subaccount),
        };
        let buyer_account = Account {
            owner: canister_self,
            subaccount: Some(buyer_subaccount),
        };
        mock_ledger.set_balance(writer_account, TEST_QUANTITY_SATS);
        setup_test_state_with_ledger(writer, buyer, mock_ledger.clone());
        set_cached_transfer_fee_for_testing(EXPECTED_TRANSFER_FEE_SATS, TEST_NOW_SECONDS);
        let platform_fees_before = get_platform_fees_collected();
        let prepared_settlement_execution =
            prepare_settlement_execution(TEST_OPTION_ID, TEST_SETTLEMENT_PRICE_CENTS)
                .expect("settlement should be prepared");
        let operation_id = prepared_settlement_execution.operation_id;

        // when
        let first_attempt = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            let _ = execute_wal_entry_now_blocking(operation_id);
        }));
        assert!(first_attempt.is_err(), "first attempt should trap");

        let wal_entry_after_trap = get_entry(operation_id).expect("wal entry should exist");
        let settlement_after_trap =
            get_settlement(TEST_OPTION_ID).expect("settlement should remain pending");

        const SIXTEEN_MINUTES_NS: u64 = 16 * 60 * 1_000_000_000;
        ic::set_runtime(Box::new(RuntimeAt {
            now_ns: TEST_NOW_NS.saturating_add(SIXTEEN_MINUTES_NS),
        }));
        let promoted_count = crate::journaling::promote_stale_in_flight_to_recovery_required();
        let replay_outcome = execute_wal_entry_now_blocking(operation_id);
        let settlement_status = get_settlement_status_use_case(operation_id)
            .expect("settlement status should load after replay");

        // then
        assert_eq!(wal_entry_after_trap.status, WalStatus::InFlight);
        assert_eq!(
            settlement_after_trap.phase,
            SettlementPhase::BalanceReleased
        );
        assert_eq!(promoted_count, 1);
        assert_eq!(replay_outcome, WalExecutionOutcome::Succeeded);
        assert!(matches!(
            settlement_status,
            SettlementStatus::Succeeded { .. }
        ));

        let writer_balance = get_balance(&writer);
        let buyer_balance = get_balance(&buyer);
        assert_eq!(buyer_balance.available, EXPECTED_BUYER_PAYOUT_SATS);
        assert_eq!(buyer_balance.locked_as_writer, 0);
        assert_eq!(
            writer_balance.available,
            EXPECTED_EFFECTIVE_WRITER_PAYOUT_SATS
        );
        assert_eq!(writer_balance.locked_as_writer, 0);
        assert_eq!(
            get_platform_fees_collected() - platform_fees_before,
            EXPECTED_PROFIT_FEE_SATS
        );
        assert_eq!(
            settlement_replay_running_total_sats(writer, buyer, platform_fees_before),
            TEST_QUANTITY_SATS - EXPECTED_SETTLEMENT_TRANSFER_FEES_SATS
        );

        assert_eq!(
            mock_ledger.transfer_call_count(),
            EXPECTED_TRANSFER_CALL_COUNT
        );
        assert_eq!(
            mock_ledger.economic_transfer_count(),
            SETTLEMENT_TRANSFER_COUNT
        );
        assert_eq!(
            mock_ledger.balance_of_account(&buyer_account),
            EXPECTED_BUYER_PAYOUT_SATS
        );
        assert_eq!(
            mock_ledger.balance_of_account(&Account {
                owner: get_fee_recipient(),
                subaccount: None,
            }),
            EXPECTED_PROFIT_FEE_SATS
        );
        assert_eq!(
            writer_balance.total(),
            mock_ledger.balance_of_account(&writer_account)
        );
        assert!(get_settlement(TEST_OPTION_ID).is_none());
    }

    /// Given: settlement traps after the first transfer and leaves WAL attempt in-flight
    /// When: stale in-flight WAL is promoted and manually replayed
    /// Then: recovery succeeds without duplicating buyer payout or corrupting balances
    #[test]
    fn test_settlement_recovery_after_trap_post_first_transfer() {
        // given
        let writer = test_principal(31);
        let buyer = test_principal(32);
        let trap_once_ledger = Rc::new(TrapAfterFirstTransferOnceLedger::new());
        setup_test_state_with_ledger(writer, buyer, trap_once_ledger.clone());
        let prepared_settlement_execution =
            prepare_settlement_execution(TEST_OPTION_ID, TEST_SETTLEMENT_PRICE_CENTS)
                .expect("settlement should be prepared");
        let operation_id = prepared_settlement_execution.operation_id;

        // when
        let first_attempt = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            let _ = execute_wal_entry_now_blocking(operation_id);
        }));
        assert!(first_attempt.is_err(), "first attempt should trap");

        let wal_entry_after_trap = get_entry(operation_id).expect("wal entry should exist");
        assert_eq!(wal_entry_after_trap.status, WalStatus::InFlight);

        const SIXTEEN_MINUTES_NS: u64 = 16 * 60 * 1_000_000_000;
        ic::set_runtime(Box::new(RuntimeAt {
            now_ns: TEST_NOW_NS.saturating_add(SIXTEEN_MINUTES_NS),
        }));
        let promoted_count = crate::journaling::promote_stale_in_flight_to_recovery_required();
        let wal_entry_after_promotion = get_entry(operation_id).expect("wal entry should exist");
        let replay_outcome = execute_wal_entry_now_blocking(operation_id);
        let settlement_status = get_settlement_status_use_case(operation_id)
            .expect("settlement status should load after replay");

        // then
        assert_eq!(promoted_count, 1);
        assert_eq!(
            wal_entry_after_promotion.status,
            WalStatus::RecoveryRequired
        );
        assert_eq!(replay_outcome, WalExecutionOutcome::Succeeded);
        assert!(matches!(
            settlement_status,
            SettlementStatus::Succeeded { .. }
        ));

        let writer_balance = get_balance(&writer);
        let buyer_balance = get_balance(&buyer);
        const EXPECTED_GROSS_BUYER_PAYOUT_SATS: u64 = 125_000;
        const EXPECTED_PROFIT_FEE_SATS: u64 = 12_500;
        const EXPECTED_BUYER_PAYOUT_SATS: u64 =
            EXPECTED_GROSS_BUYER_PAYOUT_SATS - EXPECTED_PROFIT_FEE_SATS;
        const EXPECTED_EFFECTIVE_WRITER_PAYOUT_SATS: u64 = (TEST_QUANTITY_SATS
            - EXPECTED_GROSS_BUYER_PAYOUT_SATS)
            .saturating_sub(EXPECTED_SETTLEMENT_TRANSFER_FEES_SATS);
        const EXPECTED_TRANSFER_CALL_COUNT: u64 = 3;
        assert_eq!(buyer_balance.available, EXPECTED_BUYER_PAYOUT_SATS);
        assert_eq!(buyer_balance.locked_as_writer, 0);
        assert_eq!(
            writer_balance.available,
            EXPECTED_EFFECTIVE_WRITER_PAYOUT_SATS
        );
        assert_eq!(writer_balance.locked_as_writer, 0);
        assert!(
            get_settlement(TEST_OPTION_ID).is_none(),
            "settlement journal should be removed after recovery replay"
        );
        assert_eq!(
            trap_once_ledger.transfer_call_count(),
            EXPECTED_TRANSFER_CALL_COUNT
        );
    }
}
