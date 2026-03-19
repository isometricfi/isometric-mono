use std::collections::BTreeMap;

use candid::{CandidType, Principal};
use icrc_ledger_types::icrc1::account::Account;
use serde::{Deserialize, Serialize};

use crate::auth::derive_subaccount;
use crate::errors::{error_codes, VolumetricError};
use crate::guards::{validate_offer_params, OfferParams};
use crate::ic;
use crate::journaling::{
    default_policy, enqueue_if_absent, execute_wal_entry_now, get_entry, register_retryable_error,
    AcceptWalPayload, AcceptWalPreparedAccept, AcceptWalTransfer, DispatchError, OperationId,
    RunOutcome, WalKind, WalPayload, WalResult,
};
use crate::locks::AcceptLock;
use crate::oracle::get_btc_usd_price_cents;
use crate::storage::{
    add_available, add_platform_fee, calculate_premium_fee, calculate_premium_in_sats,
    calculate_strike_price_in_cents, complete_accept, create_accept_journal_entry, emit_event,
    fail_accept, get_active_option, get_balance, get_fee_recipient, get_offer,
    insert_active_option, list_pending_accepts, lock_collateral, next_id, remove_accept,
    subtract_available, unlock_collateral, update_accept_phase, update_offer, AcceptPhase,
    AcceptedOffer, ActiveOption, ActiveOptionStatus, Asset, Config, CounterKey, EventData,
    EventType, OfferStatus, OptionType, TradeRole, CKBTC_TRANSFER_FEE,
};
use crate::time::calculate_expiry_ns;

use crate::usecases::balances::transfer_ckbtc;

pub struct AcceptOfferItem {
    pub offer_id: u64,
    pub quantity: u64,
}

pub struct AcceptOffersResult {
    pub active_options: Vec<ActiveOption>,
    pub fill_group_id: u64,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
pub struct AcceptWalResult {
    pub option_ids: Vec<u64>,
    pub fill_group_id: u64,
}

struct PreparedAcceptBatch {
    prepared_accepts: Vec<PreparedAccept>,
    total_premium_required_sats: u64,
    total_platform_fee_sats: u64,
}

struct PreparedAccept {
    offer_id: u64,
    writer: Principal,
    asset: Asset,
    option_type: OptionType,
    strike_basis_points: u16,
    quantity_sats: u64,
    premium_sats: u64,
    premium_to_writer_sats: u64,
    premium_fee_sats: u64,
    option_id: u64,
    expiry_ns: u64,
    original_remaining_quantity_sats: u64,
    original_status: OfferStatus,
    profit_fee_basis_points: u64,
}

struct LockedCollateralState {
    writer: Principal,
    collateral_locked_sats: u64,
    offer_id: u64,
    original_remaining_quantity_sats: u64,
    original_status: OfferStatus,
}

pub async fn accept_offers_use_case(
    buyer_principal: Principal,
    accept_offer_items: Vec<AcceptOfferItem>,
    request_nonce: u64,
) -> Result<AcceptOffersResult, VolumetricError> {
    // bind to _lock, not `let _ =` which drops immediately
    let _buyer_accept_lock = AcceptLock::new(buyer_principal)?;
    let ledger_transfer_created_at_time_ns = ic::time();

    if list_pending_accepts()
        .into_iter()
        .any(|pending_accept| pending_accept.buyer == buyer_principal)
    {
        return Err(VolumetricError::from_def(
            error_codes::ACCEPT_IN_PROGRESS,
            None,
            None,
        ));
    }

    if accept_offer_items.is_empty() {
        return Err(VolumetricError::from_def(
            error_codes::INTERNAL_ERROR,
            Some("No items to accept"),
            None,
        ));
    }

    let operation_id = accept_operation_id(buyer_principal, &accept_offer_items, request_nonce);
    if let Some(existing_wal_entry) = get_entry(operation_id) {
        match existing_wal_entry.result {
            Some(WalResult::Accept(existing_accept_result)) => {
                return Ok(AcceptOffersResult {
                    active_options: load_active_options_by_ids(&existing_accept_result.option_ids)?,
                    fill_group_id: existing_accept_result.fill_group_id,
                });
            }
            _ => {
                return Err(VolumetricError::from_def(
                    error_codes::ACCEPT_IN_PROGRESS,
                    Some("accept already scheduled"),
                    None,
                ));
            }
        }
    }

    if is_stitched_accept_request(&accept_offer_items) && !Config::is_stitching_enabled() {
        return Err(VolumetricError::from_def(
            error_codes::STITCHING_DISABLED,
            None,
            None,
        ));
    }

    let current_time_ns = ic::time();
    let entry_price_cents = get_btc_usd_price_cents().await?;
    let fill_group_id = next_id(CounterKey::FillGroupId);

    let prepared_accept_batch =
        prepare_offer_acceptances(buyer_principal, &accept_offer_items, current_time_ns)?;

    let buyer_balance_sats = get_balance(&buyer_principal);
    if buyer_balance_sats.available < prepared_accept_batch.total_premium_required_sats {
        return Err(VolumetricError::from_def(
            error_codes::INSUFFICIENT_BALANCE,
            Some(&format!(
                "available: {}, required: {}",
                buyer_balance_sats.available, prepared_accept_batch.total_premium_required_sats
            )),
            None,
        ));
    }

    let accepted_offers =
        build_accepted_offers_for_journal(&prepared_accept_batch.prepared_accepts);

    let accept_journal_entry = create_accept_journal_entry(
        buyer_principal,
        prepared_accept_batch.total_premium_required_sats,
        accepted_offers,
        fill_group_id,
    );
    let accept_journal_entry_id = accept_journal_entry.id;

    let locked_collateral_states = lock_collateral_for_offer_acceptances(
        &prepared_accept_batch.prepared_accepts,
        accept_journal_entry_id,
    )?;

    update_accept_phase(accept_journal_entry_id, AcceptPhase::CollateralLocked);

    if let Err(e) = subtract_available(
        buyer_principal,
        prepared_accept_batch.total_premium_required_sats,
    ) {
        rollback_locked_collateral_states_and_offers(&locked_collateral_states);
        fail_accept(
            accept_journal_entry_id,
            format!("subtract_available failed: {:?}", e),
        );
        return Err(VolumetricError::from_def(
            error_codes::INSUFFICIENT_BALANCE,
            Some(&format!(
                "available: {}, required: {}",
                e.available, e.required
            )),
            None,
        ));
    }

    update_accept_phase(accept_journal_entry_id, AcceptPhase::BuyerDebited);

    let wal_payload = build_accept_wal_payload(
        accept_journal_entry_id,
        buyer_principal,
        fill_group_id,
        prepared_accept_batch.total_platform_fee_sats,
        ledger_transfer_created_at_time_ns,
        &prepared_accept_batch.prepared_accepts,
        entry_price_cents,
        current_time_ns,
    );

    enqueue_if_absent(
        operation_id,
        WalKind::Accept,
        WalPayload::Accept(wal_payload.clone()),
        default_policy(),
    );

    match execute_wal_entry_now(operation_id).await {
        RunOutcome::Succeeded | RunOutcome::SucceededAlready => {
            let wal_entry = get_entry(operation_id).ok_or_else(|| {
                VolumetricError::from_def(
                    error_codes::INTERNAL_ERROR,
                    Some("accept completed without wal entry"),
                    None,
                )
            })?;

            let wal_result = wal_entry.result.ok_or_else(|| {
                VolumetricError::from_def(
                    error_codes::INTERNAL_ERROR,
                    Some("accept completed without result"),
                    None,
                )
            })?;

            let accept_wal_result = match wal_result {
                WalResult::Accept(result) => result,
                _ => {
                    return Err(VolumetricError::from_def(
                        error_codes::INTERNAL_ERROR,
                        Some("accept completed with unexpected wal result type"),
                        None,
                    ));
                }
            };

            Ok(AcceptOffersResult {
                active_options: load_active_options_by_ids(&accept_wal_result.option_ids)?,
                fill_group_id: accept_wal_result.fill_group_id,
            })
        }
        RunOutcome::SkippedAlreadyInFlight | RunOutcome::FailedRetryable(_) => {
            Err(VolumetricError::from_def(
                error_codes::INTER_CANISTER_CALL_FAILED,
                Some("accept queued for retry"),
                None,
            ))
        }
        RunOutcome::FailedPermanent(message) => {
            rollback_locked_collateral_states_and_offers(&locked_collateral_states);
            add_available(
                buyer_principal,
                prepared_accept_batch.total_premium_required_sats,
            );
            fail_accept(accept_journal_entry_id, message.clone());
            Err(VolumetricError::from_def(
                error_codes::INTER_CANISTER_CALL_FAILED,
                Some(&message),
                None,
            ))
        }
    }
}

fn is_stitched_accept_request(accept_offer_items: &[AcceptOfferItem]) -> bool {
    accept_offer_items.len() > 1
}

fn rollback_locked_collateral_states_and_offers(
    locked_collateral_states: &[LockedCollateralState],
) {
    for locked_collateral_state in locked_collateral_states {
        let _ = unlock_collateral(
            locked_collateral_state.writer,
            locked_collateral_state.collateral_locked_sats,
        );

        if let Some(mut offer_to_restore) = get_offer(locked_collateral_state.offer_id) {
            offer_to_restore.remaining_quantity =
                locked_collateral_state.original_remaining_quantity_sats;
            offer_to_restore.status = locked_collateral_state.original_status;
            update_offer(offer_to_restore);
        }
    }
}

fn prepare_offer_acceptances(
    buyer_principal: Principal,
    accept_offer_items: &[AcceptOfferItem],
    current_time_ns: u64,
) -> Result<PreparedAcceptBatch, VolumetricError> {
    let mut prepared_accepts: Vec<PreparedAccept> = Vec::with_capacity(accept_offer_items.len());
    let mut total_premium_sats: u64 = 0;
    let mut total_platform_fee_sats: u64 = 0;
    let mut writer_premium_by_principal: BTreeMap<Principal, u64> = BTreeMap::new();

    for accept_offer_item in accept_offer_items {
        let offer = get_offer(accept_offer_item.offer_id).ok_or_else(|| {
            VolumetricError::from_def(
                error_codes::OFFER_NOT_FOUND,
                Some(&format!("id: {}", accept_offer_item.offer_id)),
                None,
            )
        })?;

        validate_offer_acceptance(buyer_principal, accept_offer_item, &offer, current_time_ns)?;

        let writer_available_balance_sats = get_balance(&offer.writer);
        if writer_available_balance_sats.available < accept_offer_item.quantity {
            let mut updated_offer = offer.clone();
            updated_offer.status = OfferStatus::Cancelled;
            update_offer(updated_offer);
            return Err(VolumetricError::from_def(
                error_codes::INSUFFICIENT_BALANCE,
                Some(&format!(
                    "available: {}, required: {}",
                    writer_available_balance_sats.available, accept_offer_item.quantity
                )),
                None,
            ));
        }

        let platform_fee_config = Config::fee_config();
        let premium_sats =
            calculate_premium_in_sats(accept_offer_item.quantity, offer.premium_basis_points);
        let premium_fee_sats = calculate_premium_fee(premium_sats);
        let premium_to_writer_sats = premium_sats.saturating_sub(premium_fee_sats);

        total_premium_sats = total_premium_sats.saturating_add(premium_sats);
        total_platform_fee_sats = total_platform_fee_sats.saturating_add(premium_fee_sats);
        writer_premium_by_principal
            .entry(offer.writer)
            .and_modify(|writer_premium_sats| {
                *writer_premium_sats = writer_premium_sats.saturating_add(premium_to_writer_sats);
            })
            .or_insert(premium_to_writer_sats);

        let active_option_id = next_id(CounterKey::ActiveOptionId);

        // Round up to next hour boundary, then add full duration.
        // This ensures users get at least their full duration and all expiries
        // land on hour boundaries for efficient batch settlement.
        let option_expiry_ns = calculate_expiry_ns(current_time_ns, offer.option_duration_seconds)
            .ok_or_else(|| {
                VolumetricError::from_def(
                    error_codes::INTERNAL_ERROR,
                    Some("Expiry timestamp overflow"),
                    None,
                )
            })?;

        prepared_accepts.push(PreparedAccept {
            offer_id: offer.id,
            writer: offer.writer,
            asset: offer.asset,
            option_type: offer.option_type,
            strike_basis_points: offer.strike_basis_points,
            quantity_sats: accept_offer_item.quantity,
            premium_sats,
            premium_to_writer_sats,
            premium_fee_sats,
            option_id: active_option_id,
            expiry_ns: option_expiry_ns,
            original_remaining_quantity_sats: offer.remaining_quantity,
            original_status: offer.status,
            profit_fee_basis_points: platform_fee_config.profit_fee_basis_points,
        });
    }

    let total_transfer_count =
        writer_premium_by_principal.len() as u64 + u64::from(total_platform_fee_sats > 0);
    let total_premium_required_sats =
        total_premium_sats.saturating_add(total_transfer_count * CKBTC_TRANSFER_FEE);

    Ok(PreparedAcceptBatch {
        prepared_accepts,
        total_premium_required_sats,
        total_platform_fee_sats,
    })
}

fn validate_offer_acceptance(
    buyer_principal: Principal,
    accept_offer_item: &AcceptOfferItem,
    offer: &crate::storage::Offer,
    current_time_ns: u64,
) -> Result<(), VolumetricError> {
    validate_offer_params(&OfferParams {
        quantity: accept_offer_item.quantity,
        strike_basis_points: offer.strike_basis_points,
        premium_basis_points: offer.premium_basis_points,
        option_duration_seconds: offer.option_duration_seconds,
    })?;

    if offer.writer == buyer_principal {
        return Err(VolumetricError::from_def(
            error_codes::CANNOT_ACCEPT_OWN_OFFER,
            None,
            None,
        ));
    }

    if !is_offer_status_acceptable_for_acceptance(offer.status) {
        return Err(VolumetricError::from_def(
            error_codes::INVALID_OFFER_STATE,
            Some(&format!(
                "cannot accept offer with status: {:?}",
                offer.status
            )),
            None,
        ));
    }

    if offer.offer_valid_until <= current_time_ns {
        return Err(VolumetricError::from_def(
            error_codes::OFFER_EXPIRED,
            None,
            None,
        ));
    }

    if accept_offer_item.quantity > offer.remaining_quantity {
        return Err(VolumetricError::from_def(
            error_codes::QUANTITY_EXCEEDS_AVAILABLE,
            Some(&format!(
                "requested: {}, available: {}",
                accept_offer_item.quantity, offer.remaining_quantity
            )),
            None,
        ));
    }

    if accept_offer_item.quantity < offer.remaining_quantity
        && !Config::is_partial_filling_enabled()
    {
        return Err(VolumetricError::from_def(
            error_codes::PARTIAL_FILLING_DISABLED,
            None,
            None,
        ));
    }

    Ok(())
}

fn is_offer_status_acceptable_for_acceptance(status: OfferStatus) -> bool {
    matches!(status, OfferStatus::Open | OfferStatus::PartiallyFilled)
}

fn build_accept_wal_payload(
    accept_journal_entry_id: u64,
    buyer: Principal,
    fill_group_id: u64,
    total_platform_fee_sats: u64,
    created_at_time_ns: u64,
    prepared_accepts: &[PreparedAccept],
    entry_price_cents: u64,
    accepted_at_ns: u64,
) -> AcceptWalPayload {
    AcceptWalPayload {
        accept_journal_entry_id,
        buyer,
        fill_group_id,
        total_platform_fee_sats,
        created_at_time_ns,
        prepared_accepts: build_accept_wal_prepared_accepts(
            prepared_accepts,
            entry_price_cents,
            accepted_at_ns,
        ),
        writer_transfers: build_accept_wal_transfers(prepared_accepts),
    }
}

fn build_accept_wal_prepared_accepts(
    prepared_accepts: &[PreparedAccept],
    entry_price_cents: u64,
    accepted_at_ns: u64,
) -> Vec<AcceptWalPreparedAccept> {
    prepared_accepts
        .iter()
        .map(|prepared_accept| AcceptWalPreparedAccept {
            offer_id: prepared_accept.offer_id,
            writer: prepared_accept.writer,
            asset: prepared_accept.asset,
            option_type: prepared_accept.option_type,
            quantity_sats: prepared_accept.quantity_sats,
            premium_sats: prepared_accept.premium_sats,
            premium_to_writer_sats: prepared_accept.premium_to_writer_sats,
            premium_fee_sats: prepared_accept.premium_fee_sats,
            option_id: prepared_accept.option_id,
            expiry_ns: prepared_accept.expiry_ns,
            strike_price_cents: calculate_strike_price_in_cents(
                entry_price_cents,
                prepared_accept.strike_basis_points,
            ),
            entry_price_cents,
            accepted_at_ns,
            profit_fee_basis_points: prepared_accept.profit_fee_basis_points,
        })
        .collect()
}

fn build_accept_wal_transfers(prepared_accepts: &[PreparedAccept]) -> Vec<AcceptWalTransfer> {
    let mut premium_by_writer: BTreeMap<Principal, u64> = BTreeMap::new();
    for prepared_accept in prepared_accepts {
        premium_by_writer
            .entry(prepared_accept.writer)
            .and_modify(|premium_sats| {
                *premium_sats = premium_sats.saturating_add(prepared_accept.premium_to_writer_sats);
            })
            .or_insert(prepared_accept.premium_to_writer_sats);
    }

    premium_by_writer
        .into_iter()
        .map(|(writer, amount_sats)| AcceptWalTransfer {
            writer,
            amount_sats,
        })
        .collect()
}

fn build_accepted_offers_for_journal(prepared_accepts: &[PreparedAccept]) -> Vec<AcceptedOffer> {
    prepared_accepts
        .iter()
        .map(|offer_acceptance| AcceptedOffer {
            offer_id: offer_acceptance.offer_id,
            writer: offer_acceptance.writer,
            quantity: offer_acceptance.quantity_sats,
            collateral_locked: offer_acceptance.quantity_sats,
            premium_to_writer: offer_acceptance.premium_to_writer_sats,
            platform_fee: offer_acceptance.premium_fee_sats,
            option_id: offer_acceptance.option_id,
        })
        .collect()
}

fn lock_collateral_for_offer_acceptances(
    prepared_accepts: &[PreparedAccept],
    accept_journal_entry_id: u64,
) -> Result<Vec<LockedCollateralState>, VolumetricError> {
    let mut locked_collateral_states: Vec<LockedCollateralState> =
        Vec::with_capacity(prepared_accepts.len());

    for offer_acceptance in prepared_accepts {
        let collateral_to_lock_sats = offer_acceptance.quantity_sats;

        if let Err(e) = lock_collateral(offer_acceptance.writer, collateral_to_lock_sats) {
            rollback_locked_collateral_states_and_offers(&locked_collateral_states);
            fail_accept(
                accept_journal_entry_id,
                format!("lock_collateral failed: {:?}", e),
            );
            return Err(VolumetricError::from_def(
                error_codes::INSUFFICIENT_BALANCE,
                Some(&format!(
                    "available: {}, required: {}",
                    e.available, e.required
                )),
                None,
            ));
        }

        let mut offer_to_update = get_offer(offer_acceptance.offer_id).unwrap();
        offer_to_update.remaining_quantity = offer_to_update
            .remaining_quantity
            .saturating_sub(offer_acceptance.quantity_sats);
        offer_to_update.status = OfferStatus::Processing;
        update_offer(offer_to_update);

        locked_collateral_states.push(LockedCollateralState {
            writer: offer_acceptance.writer,
            collateral_locked_sats: collateral_to_lock_sats,
            offer_id: offer_acceptance.offer_id,
            original_remaining_quantity_sats: offer_acceptance.original_remaining_quantity_sats,
            original_status: offer_acceptance.original_status,
        });
    }

    Ok(locked_collateral_states)
}

pub async fn run_accept_wal(payload: &AcceptWalPayload) -> Result<AcceptWalResult, DispatchError> {
    let accept = crate::storage::get_accept(payload.accept_journal_entry_id).ok_or_else(|| {
        DispatchError::Permanent(format!(
            "accept journal {} not found",
            payload.accept_journal_entry_id
        ))
    })?;
    let mut platform_fee_collected = payload.total_platform_fee_sats == 0;

    if accept.phase == AcceptPhase::BuyerDebited {
        platform_fee_collected = await_wal_writer_and_fee_transfers(payload).await?;
        update_accept_phase(
            payload.accept_journal_entry_id,
            AcceptPhase::TransfersComplete,
        );
    }

    let accept = crate::storage::get_accept(payload.accept_journal_entry_id).ok_or_else(|| {
        DispatchError::Permanent(format!(
            "accept journal {} missing before finalization",
            payload.accept_journal_entry_id
        ))
    })?;

    if accept.phase == AcceptPhase::TransfersComplete {
        create_active_options_from_wal_payload(payload, platform_fee_collected)?;
        complete_accept(payload.accept_journal_entry_id);
        remove_accept(payload.accept_journal_entry_id);
    }

    Ok(AcceptWalResult {
        option_ids: payload
            .prepared_accepts
            .iter()
            .map(|prepared_accept| prepared_accept.option_id)
            .collect(),
        fill_group_id: payload.fill_group_id,
    })
}

async fn await_wal_writer_and_fee_transfers(
    payload: &AcceptWalPayload,
) -> Result<bool, DispatchError> {
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

    if payload.total_platform_fee_sats > 0 {
        let fee_transfer_result = transfer_ckbtc(
            Some(derive_subaccount(payload.buyer)),
            Account {
                owner: get_fee_recipient(),
                subaccount: None,
            },
            payload.total_platform_fee_sats,
            payload.created_at_time_ns,
        )
        .await;

        if fee_transfer_result.is_err() {
            add_available(
                payload.buyer,
                payload
                    .total_platform_fee_sats
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
    platform_fee_collected: bool,
) -> Result<(), DispatchError> {
    for prepared_accept in &payload.prepared_accepts {
        let created_active_option = ActiveOption {
            id: prepared_accept.option_id,
            offer_id: prepared_accept.offer_id,
            buyer: payload.buyer,
            writer: prepared_accept.writer,
            asset: prepared_accept.asset,
            option_type: prepared_accept.option_type,
            quantity: prepared_accept.quantity_sats,
            entry_price_cents: prepared_accept.entry_price_cents,
            strike_price_cents: prepared_accept.strike_price_cents,
            premium_paid: if platform_fee_collected {
                prepared_accept.premium_sats
            } else {
                prepared_accept.premium_to_writer_sats
            },
            accepted_at: prepared_accept.accepted_at_ns,
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
            DispatchError::Permanent(format!(
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
            platform_fee_collected,
        );
    }

    Ok(())
}

fn emit_offer_accepted_events_from_wal(
    buyer: Principal,
    prepared_accept: &AcceptWalPreparedAccept,
    fill_group_id: u64,
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
            entry_price_cents: prepared_accept.entry_price_cents,
            strike_price_cents: prepared_accept.strike_price_cents,
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
            entry_price_cents: prepared_accept.entry_price_cents,
            strike_price_cents: prepared_accept.strike_price_cents,
            expiry_ns: prepared_accept.expiry_ns,
            role: TradeRole::Writer,
        },
    );
}

fn load_active_options_by_ids(option_ids: &[u64]) -> Result<Vec<ActiveOption>, VolumetricError> {
    option_ids
        .iter()
        .map(|option_id| {
            get_active_option(*option_id).ok_or_else(|| {
                VolumetricError::from_def(
                    error_codes::OPTION_NOT_FOUND,
                    Some(&format!("id: {}", option_id)),
                    None,
                )
            })
        })
        .collect()
}

fn accept_operation_id(
    buyer: Principal,
    accept_offer_items: &[AcceptOfferItem],
    request_nonce: u64,
) -> OperationId {
    let nonce_bytes = request_nonce.to_be_bytes();
    let item_bytes: Vec<[u8; 16]> = accept_offer_items
        .iter()
        .map(|item| {
            let mut bytes = [0u8; 16];
            bytes[..8].copy_from_slice(&item.offer_id.to_be_bytes());
            bytes[8..].copy_from_slice(&item.quantity.to_be_bytes());
            bytes
        })
        .collect();
    let mut parts: Vec<&[u8]> = Vec::with_capacity(item_bytes.len() + 2);
    parts.push(&nonce_bytes);
    for item in &item_bytes {
        parts.push(item);
    }

    OperationId::from_principal_bytes("accept", buyer, &parts)
}

#[cfg(test)]
mod tests {
    use std::cell::{Cell, RefCell};
    use std::rc::Rc;

    use async_trait::async_trait;
    use candid::Nat;
    use icrc_ledger_types::icrc2::approve::ApproveArgs;
    use tokio::sync::oneshot;
    use tokio::task;

    use super::*;
    use crate::errors::{error_codes, VolumetricError};
    use crate::ic::IcRuntime;
    use crate::ledger::{self, LedgerClient};
    use crate::oracle::{set_oracle, StubOracle};
    use crate::storage::{
        clear_active_options, clear_events, clear_offers, get_balance, get_platform_fees_collected,
        insert_offer, set_balance, Offer, UserBalance,
    };

    const TEST_NOW_NS: u64 = 1_000_000_000_000;
    const TEST_PRICE_CENTS: u64 = 10_000_000;
    const TEST_OFFER_ID: u64 = 1;
    const TEST_QUANTITY_SATS: u64 = 1_000_000;
    const TEST_STRIKE_BPS: u16 = 500;
    const TEST_PREMIUM_BPS: u16 = 100;
    const TEST_DURATION_SECS: u64 = 3_600;
    const TEST_OFFER_VALID_FOR_NS: u64 = 60_000_000_000;
    const TEST_BUYER_AVAILABLE_SATS: u64 = 200_000;
    const TEST_BLOCK_INDEX: u64 = 42;

    struct MockRuntime {
        now: u64,
    }

    impl IcRuntime for MockRuntime {
        fn time(&self) -> u64 {
            self.now
        }

        fn canister_self(&self) -> Principal {
            Principal::anonymous()
        }

        fn log(&self, _message: &str) {}
    }

    struct CoordinatedLedger {
        first_transfer_started_sender: RefCell<Option<oneshot::Sender<()>>>,
        first_transfer_result_receiver:
            RefCell<Option<oneshot::Receiver<Result<u64, VolumetricError>>>>,
        completed_transfer_count: Cell<u64>,
    }

    #[async_trait(?Send)]
    impl LedgerClient for CoordinatedLedger {
        async fn icrc1_transfer(
            &self,
            _from_subaccount: Option<[u8; 32]>,
            _to: Account,
            _amount: u64,
            _created_at_time: u64,
        ) -> Result<u64, VolumetricError> {
            let completed_transfer_count = self.completed_transfer_count.get();
            self.completed_transfer_count
                .set(completed_transfer_count + 1);

            if completed_transfer_count == 0 {
                // Stop on the first ledger transfer and tell the test we have reached the
                // point where accept is waiting. This gives the test a chance to call cancel
                // while the accept flow is still in progress.
                if let Some(first_transfer_started_sender) =
                    self.first_transfer_started_sender.borrow_mut().take()
                {
                    let _ = first_transfer_started_sender.send(());
                }

                let first_transfer_result_receiver = self
                    .first_transfer_result_receiver
                    .borrow_mut()
                    .take()
                    .expect("first transfer result receiver should exist");

                return first_transfer_result_receiver
                    .await
                    .expect("test should provide the first transfer result");
            }

            Ok(TEST_BLOCK_INDEX + completed_transfer_count)
        }

        async fn icrc1_balance_of(&self, _account: Account) -> Result<Nat, VolumetricError> {
            Ok(Nat::from(0u64))
        }

        async fn icrc2_approve(&self, _args: ApproveArgs) -> Result<Nat, VolumetricError> {
            Ok(Nat::from(0u64))
        }
    }

    struct SecondTransferFailsLedger {
        completed_transfer_count: Cell<u64>,
    }

    #[async_trait(?Send)]
    impl LedgerClient for SecondTransferFailsLedger {
        async fn icrc1_transfer(
            &self,
            _from_subaccount: Option<[u8; 32]>,
            _to: Account,
            _amount: u64,
            _created_at_time: u64,
        ) -> Result<u64, VolumetricError> {
            let completed_transfer_count = self.completed_transfer_count.get();
            self.completed_transfer_count
                .set(completed_transfer_count + 1);

            if completed_transfer_count == 0 {
                return Ok(TEST_BLOCK_INDEX);
            }

            Err(VolumetricError::from_def(
                error_codes::INTER_CANISTER_CALL_FAILED,
                Some("platform fee transfer failed"),
                None,
            ))
        }

        async fn icrc1_balance_of(&self, _account: Account) -> Result<Nat, VolumetricError> {
            Ok(Nat::from(0u64))
        }

        async fn icrc2_approve(&self, _args: ApproveArgs) -> Result<Nat, VolumetricError> {
            Ok(Nat::from(0u64))
        }
    }

    fn test_principal(seed: u8) -> Principal {
        Principal::from_slice(&[seed; 29])
    }

    fn setup_test_state(writer: Principal, buyer: Principal) {
        clear_offers();
        clear_active_options();
        clear_events();
        ic::set_runtime(Box::new(MockRuntime { now: TEST_NOW_NS }));
        set_oracle(Rc::new(StubOracle::new(TEST_PRICE_CENTS)));

        set_balance(
            writer,
            UserBalance {
                available: TEST_QUANTITY_SATS,
                locked_as_writer: 0,
            },
        );
        set_balance(
            buyer,
            UserBalance {
                available: TEST_BUYER_AVAILABLE_SATS,
                locked_as_writer: 0,
            },
        );

        insert_offer(Offer {
            id: TEST_OFFER_ID,
            writer,
            asset: Asset::CkBtc,
            option_type: OptionType::Call,
            strike_basis_points: TEST_STRIKE_BPS,
            premium_basis_points: TEST_PREMIUM_BPS,
            total_quantity: TEST_QUANTITY_SATS,
            remaining_quantity: TEST_QUANTITY_SATS,
            offer_valid_until: TEST_NOW_NS + TEST_OFFER_VALID_FOR_NS,
            option_duration_seconds: TEST_DURATION_SECS,
            status: OfferStatus::Open,
            created_at: TEST_NOW_NS,
        });
    }

    fn build_test_accept_offer_item() -> AcceptOfferItem {
        AcceptOfferItem {
            offer_id: TEST_OFFER_ID,
            quantity: TEST_QUANTITY_SATS,
        }
    }

    fn build_test_offer(writer: Principal, status: OfferStatus) -> Offer {
        Offer {
            id: TEST_OFFER_ID,
            writer,
            asset: Asset::CkBtc,
            option_type: OptionType::Call,
            strike_basis_points: TEST_STRIKE_BPS,
            premium_basis_points: TEST_PREMIUM_BPS,
            total_quantity: TEST_QUANTITY_SATS,
            remaining_quantity: TEST_QUANTITY_SATS,
            offer_valid_until: TEST_NOW_NS + TEST_OFFER_VALID_FOR_NS,
            option_duration_seconds: TEST_DURATION_SECS,
            status,
            created_at: TEST_NOW_NS,
        }
    }

    /// Given: an offer is in a state that is not allowed for acceptance
    /// When: validating the acceptance request
    /// Then: the request is rejected with the generic invalid-offer-state error
    #[test]
    fn test_validate_offer_acceptance_rejects_disallowed_statuses() {
        // given
        let writer = test_principal(55);
        let buyer = test_principal(66);
        let accept_offer_item = build_test_accept_offer_item();
        let disallowed_statuses = [
            OfferStatus::Cancelled,
            OfferStatus::Filled,
            OfferStatus::Processing,
        ];

        for disallowed_status in disallowed_statuses {
            let offer = build_test_offer(writer, disallowed_status);

            // when
            let error = validate_offer_acceptance(buyer, &accept_offer_item, &offer, TEST_NOW_NS)
                .expect_err("disallowed status should be rejected");

            // then
            assert_eq!(error.code, error_codes::INVALID_OFFER_STATE.code);
            assert!(error.message.contains(&format!("{:?}", disallowed_status)));
        }
    }

    /// Given: an offer has remaining quantity after earlier fills
    /// When: validating acceptance for a partially filled offer
    /// Then: the request is allowed
    #[test]
    fn test_validate_offer_acceptance_allows_partially_filled_status() {
        // given
        let writer = test_principal(77);
        let buyer = test_principal(88);
        let accept_offer_item = build_test_accept_offer_item();
        let offer = build_test_offer(writer, OfferStatus::PartiallyFilled);

        // when
        let result = validate_offer_acceptance(buyer, &accept_offer_item, &offer, TEST_NOW_NS);

        // then
        assert!(result.is_ok());
    }

    /// Given: an accept pauses after marking an offer as Processing
    /// When: the writer tries to cancel before the transfer resumes
    /// Then: cancellation is rejected and the accept can finish successfully
    #[tokio::test(flavor = "current_thread")]
    async fn test_processing_offer_cannot_be_cancelled_during_accept_success() {
        // given
        let writer = test_principal(11);
        let buyer = test_principal(22);
        setup_test_state(writer, buyer);

        let (first_transfer_started_sender, first_transfer_started_receiver) = oneshot::channel();
        let (first_transfer_result_sender, first_transfer_result_receiver) = oneshot::channel();
        ledger::set_ledger(Rc::new(CoordinatedLedger {
            first_transfer_started_sender: RefCell::new(Some(first_transfer_started_sender)),
            first_transfer_result_receiver: RefCell::new(Some(first_transfer_result_receiver)),
            completed_transfer_count: Cell::new(0),
        }));

        // Run the accept flow in a separate async task on this same thread. That lets the test
        // start the accept call, wait until it pauses on the mocked ledger transfer, and then
        // try cancellation before allowing the accept call to continue.
        let local_task_set = task::LocalSet::new();

        // when
        let accept_result = local_task_set
            .run_until(async move {
                let accept_offers_task = task::spawn_local(async move {
                    accept_offers_use_case(
                        buyer,
                        vec![AcceptOfferItem {
                            offer_id: TEST_OFFER_ID,
                            quantity: TEST_QUANTITY_SATS,
                        }],
                        1,
                    )
                    .await
                });

                first_transfer_started_receiver
                    .await
                    .expect("accept should reach the first transfer");

                let processing_offer =
                    get_offer(TEST_OFFER_ID).expect("offer should exist while processing");
                assert_eq!(processing_offer.status, OfferStatus::Processing);
                assert_eq!(processing_offer.remaining_quantity, 0);

                let cancel_result = crate::usecases::cancel_offer_use_case(writer, TEST_OFFER_ID);
                let cancel_error = cancel_result.expect_err("processing offer must reject cancel");
                assert_eq!(cancel_error.code, error_codes::INVALID_OFFER_STATE.code);

                first_transfer_result_sender
                    .send(Ok(TEST_BLOCK_INDEX))
                    .expect("first transfer should still be waiting");

                accept_offers_task
                    .await
                    .expect("accept task should complete")
                    .expect("accept should succeed after transfer resumes")
            })
            .await;

        // then
        assert_eq!(accept_result.active_options.len(), 1);

        let final_offer = get_offer(TEST_OFFER_ID).expect("offer should still exist");
        assert_eq!(final_offer.status, OfferStatus::Filled);
        assert_eq!(final_offer.remaining_quantity, 0);
    }

    /// Given: an accept pauses after marking an offer as Processing
    /// When: the writer tries to cancel and the transfer later fails
    /// Then: cancellation is rejected and the accept remains pending for WAL retry
    #[tokio::test(flavor = "current_thread")]
    async fn test_processing_offer_rollback_preserves_original_state_after_failed_accept() {
        // given
        let writer = test_principal(33);
        let buyer = test_principal(44);
        setup_test_state(writer, buyer);

        let (first_transfer_started_sender, first_transfer_started_receiver) = oneshot::channel();
        let (first_transfer_result_sender, first_transfer_result_receiver) = oneshot::channel();
        ledger::set_ledger(Rc::new(CoordinatedLedger {
            first_transfer_started_sender: RefCell::new(Some(first_transfer_started_sender)),
            first_transfer_result_receiver: RefCell::new(Some(first_transfer_result_receiver)),
            completed_transfer_count: Cell::new(0),
        }));

        // Run the accept flow in a separate async task on this same thread. That lets the test
        // start the accept call, wait until it pauses on the mocked ledger transfer, and then
        // try cancellation before allowing the accept call to continue.
        let local_task_set = task::LocalSet::new();

        // when
        let accept_error = local_task_set
            .run_until(async move {
                let accept_offers_task = task::spawn_local(async move {
                    accept_offers_use_case(
                        buyer,
                        vec![AcceptOfferItem {
                            offer_id: TEST_OFFER_ID,
                            quantity: TEST_QUANTITY_SATS,
                        }],
                        2,
                    )
                    .await
                });

                first_transfer_started_receiver
                    .await
                    .expect("accept should reach the first transfer");

                let processing_offer =
                    get_offer(TEST_OFFER_ID).expect("offer should exist while processing");
                assert_eq!(processing_offer.status, OfferStatus::Processing);
                assert_eq!(processing_offer.remaining_quantity, 0);

                let cancel_result = crate::usecases::cancel_offer_use_case(writer, TEST_OFFER_ID);
                let cancel_error = cancel_result.expect_err("processing offer must reject cancel");
                assert_eq!(cancel_error.code, error_codes::INVALID_OFFER_STATE.code);

                first_transfer_result_sender
                    .send(Err(VolumetricError::from_def(
                        error_codes::INTER_CANISTER_CALL_FAILED,
                        Some("transfer failed"),
                        None,
                    )))
                    .expect("first transfer should still be waiting");

                accept_offers_task
                    .await
                    .expect("accept task should complete")
                    .err()
                    .expect("accept should fail after transfer error")
            })
            .await;

        // then
        assert_eq!(
            accept_error.code,
            error_codes::INTER_CANISTER_CALL_FAILED.code
        );

        let final_offer = get_offer(TEST_OFFER_ID).expect("offer should still exist");
        assert_eq!(final_offer.status, OfferStatus::Processing);
        assert_eq!(final_offer.remaining_quantity, 0);

        let writer_balance = get_balance(&writer);
        assert_eq!(writer_balance.available, 0);
        assert_eq!(writer_balance.locked_as_writer, TEST_QUANTITY_SATS);

        let buyer_balance = get_balance(&buyer);
        assert!(buyer_balance.available < TEST_BUYER_AVAILABLE_SATS);
    }

    /// Given: the writer premium transfer succeeds but the platform fee transfer fails
    /// When: accepting the offer
    /// Then: the option is still created and only the failed fee portion is waived
    #[tokio::test(flavor = "current_thread")]
    async fn test_accept_offer_succeeds_when_platform_fee_transfer_fails() {
        // given
        let writer = test_principal(99);
        let buyer = test_principal(100);
        setup_test_state(writer, buyer);
        ledger::set_ledger(Rc::new(SecondTransferFailsLedger {
            completed_transfer_count: Cell::new(0),
        }));

        let premium_sats = calculate_premium_in_sats(TEST_QUANTITY_SATS, TEST_PREMIUM_BPS);
        let premium_fee_sats = calculate_premium_fee(premium_sats);
        let premium_to_writer_sats = premium_sats.saturating_sub(premium_fee_sats);
        let expected_buyer_available_sats = TEST_BUYER_AVAILABLE_SATS
            .saturating_sub(premium_to_writer_sats)
            .saturating_sub(CKBTC_TRANSFER_FEE);

        // when
        let result = accept_offers_use_case(buyer, vec![build_test_accept_offer_item()], 3).await;

        // then
        let accept_result = result.expect("accept should succeed when only the fee transfer fails");
        assert_eq!(accept_result.active_options.len(), 1);
        assert_eq!(
            accept_result.active_options[0].premium_paid,
            premium_to_writer_sats
        );

        let final_offer = get_offer(TEST_OFFER_ID).expect("offer should still exist");
        assert_eq!(final_offer.status, OfferStatus::Filled);
        assert_eq!(final_offer.remaining_quantity, 0);

        let writer_balance = get_balance(&writer);
        assert_eq!(writer_balance.available, premium_to_writer_sats);
        assert_eq!(writer_balance.locked_as_writer, TEST_QUANTITY_SATS);

        let buyer_balance = get_balance(&buyer);
        assert_eq!(buyer_balance.available, expected_buyer_available_sats);

        assert_eq!(get_platform_fees_collected(), 0);
    }
}
