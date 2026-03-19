use candid::Principal;
use icrc_ledger_types::icrc1::account::Account;

use crate::auth::derive_subaccount;
use crate::ic;
use crate::journaling::{
    register_retryable_error, AcceptWalPayload, AcceptWalPreparedAccept, WalExecutionError,
};
use crate::oracle::get_btc_usd_price_cents;
use crate::storage::{
    add_available, add_platform_fee, calculate_strike_price_in_cents, complete_accept, emit_event,
    fail_accept, get_accept, get_fee_recipient, get_offer, insert_active_option, remove_accept,
    update_accept_execution_snapshot, update_accept_phase, update_offer, AcceptPhase, ActiveOption,
    ActiveOptionStatus, EventData, EventType, OfferStatus, TradeRole, CKBTC_TRANSFER_FEE,
};
use crate::usecases::balances::transfer_ckbtc;

use super::accept_offers::rollback_prepared_accepts;
use super::AcceptWalResult;

pub async fn run_accept_wal(
    payload: &AcceptWalPayload,
) -> Result<AcceptWalResult, WalExecutionError> {
    let accept = get_accept(payload.accept_journal_entry_id).ok_or_else(|| {
        WalExecutionError::Permanent(format!(
            "accept journal {} not found",
            payload.accept_journal_entry_id
        ))
    })?;

    if accept.phase == AcceptPhase::BuyerDebited {
        validate_accept_finalization_state(payload)?;

        let entry_price_cents = load_or_fetch_accept_entry_price_cents(&accept).await?;
        let platform_fee_collected = execute_wal_writer_and_fee_transfers(payload).await?;

        update_accept_execution_snapshot(accept.id, entry_price_cents, platform_fee_collected);
        update_accept_phase(
            payload.accept_journal_entry_id,
            AcceptPhase::TransfersComplete,
        );

        let accept = get_accept(payload.accept_journal_entry_id).ok_or_else(|| {
            WalExecutionError::Permanent(format!(
                "accept journal {} missing before finalization",
                payload.accept_journal_entry_id
            ))
        })?;

        if accept.phase == AcceptPhase::TransfersComplete {
            finalize_transfers_complete_accept_journal(
                payload,
                &accept,
                entry_price_cents,
                platform_fee_collected,
            )?;
        }
        return Ok(build_accept_wal_result(payload));
    }

    let accept = get_accept(payload.accept_journal_entry_id).ok_or_else(|| {
        WalExecutionError::Permanent(format!(
            "accept journal {} missing before finalization",
            payload.accept_journal_entry_id
        ))
    })?;

    if accept.phase == AcceptPhase::TransfersComplete {
        let entry_price_cents = accept.entry_price_cents.ok_or_else(|| {
            WalExecutionError::Permanent(format!(
                "accept journal {} missing entry price",
                payload.accept_journal_entry_id
            ))
        })?;
        let platform_fee_collected = accept.platform_fee_collected.unwrap_or(false);
        finalize_transfers_complete_accept_journal(
            payload,
            &accept,
            entry_price_cents,
            platform_fee_collected,
        )?;
    }

    Ok(build_accept_wal_result(payload))
}

pub(crate) fn finalize_failed_accept_wal(payload: &AcceptWalPayload, message: &str) {
    let Some(accept) = get_accept(payload.accept_journal_entry_id) else {
        return;
    };

    if matches!(
        accept.phase,
        AcceptPhase::Failed { .. } | AcceptPhase::Completed
    ) {
        return;
    }

    rollback_prepared_accepts(&payload.prepared_accepts);
    add_available(payload.buyer, payload.total_buyer_debit_required_sats);
    fail_accept(payload.accept_journal_entry_id, message.to_string());
}

fn finalize_transfers_complete_accept_journal(
    payload: &AcceptWalPayload,
    accept: &crate::storage::PendingAccept,
    entry_price_cents: u64,
    platform_fee_collected: bool,
) -> Result<(), WalExecutionError> {
    create_active_options_from_wal_payload(
        payload,
        accept,
        entry_price_cents,
        platform_fee_collected,
    )?;
    complete_accept(payload.accept_journal_entry_id);
    remove_accept(payload.accept_journal_entry_id);
    Ok(())
}

fn build_accept_wal_result(payload: &AcceptWalPayload) -> AcceptWalResult {
    AcceptWalResult {
        option_ids: payload
            .prepared_accepts
            .iter()
            .map(|prepared_accept| prepared_accept.option_id)
            .collect(),
        fill_group_id: payload.fill_group_id,
    }
}

async fn load_or_fetch_accept_entry_price_cents(
    accept: &crate::storage::PendingAccept,
) -> Result<u64, WalExecutionError> {
    if let Some(entry_price_cents) = accept.entry_price_cents {
        return Ok(entry_price_cents);
    }

    let entry_price_cents = get_btc_usd_price_cents()
        .await
        .map_err(register_retryable_error)?;
    Ok(entry_price_cents)
}

fn validate_accept_finalization_state(payload: &AcceptWalPayload) -> Result<(), WalExecutionError> {
    for prepared_accept in &payload.prepared_accepts {
        if get_offer(prepared_accept.offer_id).is_none() {
            return Err(WalExecutionError::Permanent(format!(
                "offer {} not found during accept finalization",
                prepared_accept.offer_id
            )));
        }
    }

    Ok(())
}

async fn execute_wal_writer_and_fee_transfers(
    payload: &AcceptWalPayload,
) -> Result<bool, WalExecutionError> {
    for writer_transfer in &payload.writer_transfers {
        transfer_ckbtc(
            Some(derive_subaccount(payload.buyer)),
            Account {
                owner: ic::canister_self(),
                subaccount: Some(derive_subaccount(writer_transfer.writer)),
            },
            writer_transfer.amount_sats,
            payload.created_at_time_ns,
        )
        .await
        .map_err(register_retryable_error)?;
    }

    if payload.planned_platform_fee_sats > 0 {
        let fee_transfer_result = transfer_ckbtc(
            Some(derive_subaccount(payload.buyer)),
            Account {
                owner: get_fee_recipient(),
                subaccount: None,
            },
            payload.planned_platform_fee_sats,
            payload.created_at_time_ns,
        )
        .await;

        if fee_transfer_result.is_err() {
            add_available(
                payload.buyer,
                payload
                    .planned_platform_fee_sats
                    .saturating_add(CKBTC_TRANSFER_FEE),
            );
            ic::log("accept_offers: platform fee transfer failed, waiving platform fee");
            return Ok(false);
        }
    }

    Ok(true)
}

fn create_active_options_from_wal_payload(
    payload: &AcceptWalPayload,
    accept: &crate::storage::PendingAccept,
    entry_price_cents: u64,
    platform_fee_collected: bool,
) -> Result<(), WalExecutionError> {
    for prepared_accept in &payload.prepared_accepts {
        let strike_price_cents =
            calculate_strike_price_in_cents(entry_price_cents, prepared_accept.strike_basis_points);
        let created_active_option = ActiveOption {
            id: prepared_accept.option_id,
            offer_id: prepared_accept.offer_id,
            buyer: payload.buyer,
            writer: prepared_accept.writer,
            asset: prepared_accept.asset,
            option_type: prepared_accept.option_type,
            quantity: prepared_accept.quantity_sats,
            entry_price_cents,
            strike_price_cents,
            premium_paid: if platform_fee_collected {
                prepared_accept.premium_sats
            } else {
                prepared_accept.premium_to_writer_sats
            },
            accepted_at: accept.created_at,
            expiry: prepared_accept.expiry_ns,
            status: ActiveOptionStatus::Active,
            fill_group_id: Some(payload.fill_group_id),
            profit_fee_basis_points: prepared_accept.profit_fee_basis_points,
        };

        add_available(
            prepared_accept.writer,
            prepared_accept.premium_to_writer_sats,
        );
        if platform_fee_collected {
            add_platform_fee(prepared_accept.premium_fee_sats);
        }
        insert_active_option(created_active_option);

        let mut offer_to_update = get_offer(prepared_accept.offer_id).ok_or_else(|| {
            WalExecutionError::Permanent(format!(
                "offer {} not found during accept finalization",
                prepared_accept.offer_id
            ))
        })?;
        if offer_to_update.remaining_quantity == 0 {
            offer_to_update.status = OfferStatus::Filled;
        } else {
            offer_to_update.status = OfferStatus::PartiallyFilled;
        }
        update_offer(offer_to_update);

        emit_offer_accepted_events_from_wal(
            payload.buyer,
            prepared_accept,
            payload.fill_group_id,
            entry_price_cents,
            strike_price_cents,
            platform_fee_collected,
        );
    }

    Ok(())
}

fn emit_offer_accepted_events_from_wal(
    buyer: Principal,
    prepared_accept: &AcceptWalPreparedAccept,
    fill_group_id: u64,
    entry_price_cents: u64,
    strike_price_cents: u64,
    platform_fee_collected: bool,
) {
    let premium_paid_sats = if platform_fee_collected {
        prepared_accept.premium_sats
    } else {
        prepared_accept.premium_to_writer_sats
    };

    emit_event(
        buyer,
        EventType::OfferAccepted,
        EventData::OfferAccepted {
            offer_id: prepared_accept.offer_id,
            option_id: prepared_accept.option_id,
            fill_group_id,
            counterparty: prepared_accept.writer,
            quantity_sats: prepared_accept.quantity_sats,
            premium_sats: premium_paid_sats,
            entry_price_cents,
            strike_price_cents,
            expiry_ns: prepared_accept.expiry_ns,
            role: TradeRole::Buyer,
        },
    );

    emit_event(
        prepared_accept.writer,
        EventType::OfferAccepted,
        EventData::OfferAccepted {
            offer_id: prepared_accept.offer_id,
            option_id: prepared_accept.option_id,
            fill_group_id,
            counterparty: buyer,
            quantity_sats: prepared_accept.quantity_sats,
            premium_sats: premium_paid_sats,
            entry_price_cents,
            strike_price_cents,
            expiry_ns: prepared_accept.expiry_ns,
            role: TradeRole::Writer,
        },
    );
}
