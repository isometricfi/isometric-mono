use std::collections::BTreeMap;
use std::mem::size_of;

use candid::Principal;

use crate::errors::{error_codes, VolumetricError};
use crate::guards::{validate_offer_params, OfferParams};
use crate::ic;
use crate::journaling::{
    default_policy, enqueue_if_absent, get_entry, AcceptWalPayload, AcceptWalPreparedAccept,
    AcceptWalTransfer, OperationId, WalEntry, WalKind, WalPayload, WalResult, WalStatus,
};
use crate::locks::AcceptLock;
use crate::storage::{
    calculate_premium_fee, calculate_premium_in_sats, create_accept_journal_entry, fail_accept,
    get_accept, get_active_option, get_balance, get_offer, list_pending_accepts, lock_collateral,
    next_id, subtract_available, unlock_collateral, update_accept_phase, update_offer, AcceptPhase,
    AcceptedOffer, ActiveOption, Asset, Config, CounterKey, OfferStatus, OptionType,
    CKBTC_TRANSFER_FEE,
};
use crate::time::calculate_expiry_ns;

use super::{
    AcceptOfferItem, AcceptOffersReceipt, AcceptOffersResult, AcceptOffersStatus, AcceptWalResult,
};

struct AcceptExecutionPreparation {
    prepared_accept_executions: Vec<PreparedAcceptExecution>,
    total_buyer_debit_required_sats: u64,
    planned_platform_fee_sats: u64,
}

struct PreparedAcceptExecution {
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

struct LockedCollateralReservation {
    writer: Principal,
    collateral_locked_sats: u64,
    offer_id: u64,
    original_remaining_quantity_sats: u64,
    original_status: OfferStatus,
}

pub fn accept_offers_use_case(
    buyer_principal: Principal,
    accept_offer_items: Vec<AcceptOfferItem>,
    request_nonce: u64,
) -> Result<AcceptOffersReceipt, VolumetricError> {
    let _buyer_accept_lock = AcceptLock::new(buyer_principal)?;
    validate_accept_request(&accept_offer_items)?;

    let operation_id = accept_operation_id(buyer_principal, &accept_offer_items, request_nonce);
    if let Some(existing_receipt) = load_receipt_if_already_accepted(operation_id)? {
        return Ok(existing_receipt);
    }

    ensure_no_other_accept_in_progress(buyer_principal)?;

    let ledger_transfer_created_at_time_ns = ic::time();
    let current_time_ns = ic::time();

    let accept_receipt = prepare_accept_execution(
        buyer_principal,
        &accept_offer_items,
        operation_id,
        current_time_ns,
        ledger_transfer_created_at_time_ns,
    )?;

    schedule_accept_wal_execution(accept_receipt.operation_id);

    Ok(accept_receipt)
}

pub fn get_accept_status_use_case(
    operation_id: OperationId,
) -> Result<AcceptOffersStatus, VolumetricError> {
    let wal_entry = get_entry(operation_id).ok_or_else(|| {
        VolumetricError::from_def(error_codes::INTERNAL_ERROR, Some("accept not found"), None)
    })?;
    let accept_receipt = build_accept_receipt_from_wal_entry(operation_id, &wal_entry)?;

    match wal_entry.status {
        WalStatus::Succeeded => Ok(AcceptOffersStatus::Succeeded {
            receipt: accept_receipt,
            result: build_accept_result(load_accept_wal_result(operation_id)?)?,
        }),
        WalStatus::FailedPermanent => Ok(AcceptOffersStatus::Failed {
            receipt: accept_receipt.clone(),
            message: load_failed_accept_message(
                accept_receipt.accept_journal_entry_id,
                wal_entry.last_err,
            )?,
        }),
        WalStatus::Enqueued | WalStatus::InFlight | WalStatus::FailedRetryable => {
            let pending_accept = load_accept_journal_entry(accept_receipt.accept_journal_entry_id)?;
            Ok(AcceptOffersStatus::Pending {
                receipt: accept_receipt,
                phase: pending_accept.phase,
                last_error: wal_entry.last_err,
            })
        }
    }
}

pub(super) fn validate_accept_offer_request(
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

pub(super) fn rollback_prepared_accepts(prepared_accepts: &[AcceptWalPreparedAccept]) {
    for prepared_accept in prepared_accepts {
        let _ = unlock_collateral(prepared_accept.writer, prepared_accept.quantity_sats);

        if let Some(mut offer_to_restore) = get_offer(prepared_accept.offer_id) {
            offer_to_restore.remaining_quantity = prepared_accept.original_remaining_quantity_sats;
            offer_to_restore.status = prepared_accept.original_status;
            update_offer(offer_to_restore);
        }
    }
}

fn load_receipt_if_already_accepted(
    operation_id: OperationId,
) -> Result<Option<AcceptOffersReceipt>, VolumetricError> {
    let Some(existing_wal_entry) = get_entry(operation_id) else {
        return Ok(None);
    };

    build_accept_receipt_from_wal_entry(operation_id, &existing_wal_entry).map(Some)
}

fn ensure_no_other_accept_in_progress(buyer_principal: Principal) -> Result<(), VolumetricError> {
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

    Ok(())
}

fn prepare_accept_execution(
    buyer_principal: Principal,
    accept_offer_items: &[AcceptOfferItem],
    operation_id: OperationId,
    current_time_ns: u64,
    ledger_transfer_created_at_time_ns: u64,
) -> Result<AcceptOffersReceipt, VolumetricError> {
    let fill_group_id = next_id(CounterKey::FillGroupId);
    let accept_execution_preparation =
        prepare_offer_acceptances(buyer_principal, accept_offer_items, current_time_ns)?;

    ensure_buyer_has_required_debit(
        buyer_principal,
        accept_execution_preparation.total_buyer_debit_required_sats,
    )?;

    let accepted_offers =
        build_accepted_offers_for_journal(&accept_execution_preparation.prepared_accept_executions);
    let accept_journal_entry = create_accept_journal_entry(
        buyer_principal,
        accept_execution_preparation.total_buyer_debit_required_sats,
        accepted_offers,
        fill_group_id,
    );
    let accept_journal_entry_id = accept_journal_entry.id;
    let locked_collateral_reservations = lock_collateral_for_offer_acceptances(
        &accept_execution_preparation.prepared_accept_executions,
        accept_journal_entry_id,
    )?;

    update_accept_phase(accept_journal_entry_id, AcceptPhase::CollateralLocked);
    debit_buyer_available_balance(
        buyer_principal,
        accept_execution_preparation.total_buyer_debit_required_sats,
        accept_journal_entry_id,
        &locked_collateral_reservations,
    )?;
    update_accept_phase(accept_journal_entry_id, AcceptPhase::BuyerDebited);

    let wal_payload = build_accept_wal_payload(
        accept_journal_entry_id,
        buyer_principal,
        fill_group_id,
        accept_execution_preparation.total_buyer_debit_required_sats,
        accept_execution_preparation.planned_platform_fee_sats,
        ledger_transfer_created_at_time_ns,
        &accept_execution_preparation.prepared_accept_executions,
    );

    enqueue_if_absent(
        operation_id,
        WalKind::Accept,
        WalPayload::Accept(wal_payload),
        default_policy(),
    );

    Ok(AcceptOffersReceipt {
        operation_id,
        accept_journal_entry_id,
        fill_group_id,
    })
}

fn validate_accept_request(accept_offer_items: &[AcceptOfferItem]) -> Result<(), VolumetricError> {
    if accept_offer_items.is_empty() {
        return Err(VolumetricError::from_def(
            error_codes::INTERNAL_ERROR,
            Some("No items to accept"),
            None,
        ));
    }

    if is_stitched_accept_request(accept_offer_items) && !Config::is_stitching_enabled() {
        return Err(VolumetricError::from_def(
            error_codes::STITCHING_DISABLED,
            None,
            None,
        ));
    }

    Ok(())
}

fn is_stitched_accept_request(accept_offer_items: &[AcceptOfferItem]) -> bool {
    accept_offer_items.len() > 1
}

fn prepare_offer_acceptances(
    buyer_principal: Principal,
    accept_offer_items: &[AcceptOfferItem],
    current_time_ns: u64,
) -> Result<AcceptExecutionPreparation, VolumetricError> {
    let mut prepared_accept_executions: Vec<PreparedAcceptExecution> =
        Vec::with_capacity(accept_offer_items.len());

    let mut total_premium_sats: u64 = 0;
    let mut planned_platform_fee_sats: u64 = 0;
    let mut writer_premium_by_principal: BTreeMap<Principal, u64> = BTreeMap::new();

    for accept_offer_item in accept_offer_items {
        let offer = get_offer(accept_offer_item.offer_id).ok_or_else(|| {
            VolumetricError::from_def(
                error_codes::OFFER_NOT_FOUND,
                Some(&format!("id: {}", accept_offer_item.offer_id)),
                None,
            )
        })?;

        validate_accept_offer_request(buyer_principal, accept_offer_item, &offer, current_time_ns)?;

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
        planned_platform_fee_sats = planned_platform_fee_sats.saturating_add(premium_fee_sats);

        writer_premium_by_principal
            .entry(offer.writer)
            .and_modify(|writer_premium_sats| {
                *writer_premium_sats = writer_premium_sats.saturating_add(premium_to_writer_sats);
            })
            .or_insert(premium_to_writer_sats);

        let active_option_id = next_id(CounterKey::ActiveOptionId);
        let option_expiry_ns = calculate_expiry_ns(current_time_ns, offer.option_duration_seconds)
            .ok_or_else(|| {
                VolumetricError::from_def(
                    error_codes::INTERNAL_ERROR,
                    Some("Expiry timestamp overflow"),
                    None,
                )
            })?;

        prepared_accept_executions.push(PreparedAcceptExecution {
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

    let writer_transfer_count = writer_premium_by_principal.len() as u64;
    let has_planned_platform_fee = planned_platform_fee_sats > 0;
    let platform_fee_transfer_count = u64::from(has_planned_platform_fee);
    let total_transfer_count = writer_transfer_count + platform_fee_transfer_count;
    let total_transfer_fees_sats = total_transfer_count.saturating_mul(CKBTC_TRANSFER_FEE);

    let total_buyer_debit_required_sats =
        total_premium_sats.saturating_add(total_transfer_fees_sats);

    Ok(AcceptExecutionPreparation {
        prepared_accept_executions,
        total_buyer_debit_required_sats,
        planned_platform_fee_sats,
    })
}

fn ensure_buyer_has_required_debit(
    buyer_principal: Principal,
    total_buyer_debit_required_sats: u64,
) -> Result<(), VolumetricError> {
    let buyer_balance_sats = get_balance(&buyer_principal);
    if buyer_balance_sats.available < total_buyer_debit_required_sats {
        return Err(VolumetricError::from_def(
            error_codes::INSUFFICIENT_BALANCE,
            Some(&format!(
                "available: {}, required: {}",
                buyer_balance_sats.available, total_buyer_debit_required_sats
            )),
            None,
        ));
    }

    Ok(())
}

fn build_accepted_offers_for_journal(
    prepared_accept_executions: &[PreparedAcceptExecution],
) -> Vec<AcceptedOffer> {
    prepared_accept_executions
        .iter()
        .map(|prepared_accept_execution| AcceptedOffer {
            offer_id: prepared_accept_execution.offer_id,
            writer: prepared_accept_execution.writer,
            quantity: prepared_accept_execution.quantity_sats,
            collateral_locked: prepared_accept_execution.quantity_sats,
            premium_to_writer: prepared_accept_execution.premium_to_writer_sats,
            platform_fee: prepared_accept_execution.premium_fee_sats,
            option_id: prepared_accept_execution.option_id,
        })
        .collect()
}

fn build_accept_wal_payload(
    accept_journal_entry_id: u64,
    buyer: Principal,
    fill_group_id: u64,
    total_buyer_debit_required_sats: u64,
    planned_platform_fee_sats: u64,
    created_at_time_ns: u64,
    prepared_accept_executions: &[PreparedAcceptExecution],
) -> AcceptWalPayload {
    AcceptWalPayload {
        accept_journal_entry_id,
        buyer,
        fill_group_id,
        total_buyer_debit_required_sats,
        planned_platform_fee_sats,
        created_at_time_ns,
        prepared_accepts: build_accept_wal_prepared_accepts(prepared_accept_executions),
        writer_transfers: build_accept_wal_transfers(prepared_accept_executions),
    }
}

fn build_accept_wal_prepared_accepts(
    prepared_accept_executions: &[PreparedAcceptExecution],
) -> Vec<AcceptWalPreparedAccept> {
    prepared_accept_executions
        .iter()
        .map(|prepared_accept_execution| AcceptWalPreparedAccept {
            offer_id: prepared_accept_execution.offer_id,
            writer: prepared_accept_execution.writer,
            asset: prepared_accept_execution.asset,
            option_type: prepared_accept_execution.option_type,
            strike_basis_points: prepared_accept_execution.strike_basis_points,
            quantity_sats: prepared_accept_execution.quantity_sats,
            premium_sats: prepared_accept_execution.premium_sats,
            premium_to_writer_sats: prepared_accept_execution.premium_to_writer_sats,
            premium_fee_sats: prepared_accept_execution.premium_fee_sats,
            option_id: prepared_accept_execution.option_id,
            expiry_ns: prepared_accept_execution.expiry_ns,
            original_remaining_quantity_sats: prepared_accept_execution
                .original_remaining_quantity_sats,
            original_status: prepared_accept_execution.original_status,
            profit_fee_basis_points: prepared_accept_execution.profit_fee_basis_points,
        })
        .collect()
}

fn build_accept_wal_transfers(
    prepared_accept_executions: &[PreparedAcceptExecution],
) -> Vec<AcceptWalTransfer> {
    let mut premium_by_writer: BTreeMap<Principal, u64> = BTreeMap::new();
    for prepared_accept_execution in prepared_accept_executions {
        premium_by_writer
            .entry(prepared_accept_execution.writer)
            .and_modify(|premium_sats| {
                *premium_sats =
                    premium_sats.saturating_add(prepared_accept_execution.premium_to_writer_sats);
            })
            .or_insert(prepared_accept_execution.premium_to_writer_sats);
    }

    premium_by_writer
        .into_iter()
        .map(|(writer, amount_sats)| AcceptWalTransfer {
            writer,
            amount_sats,
        })
        .collect()
}

fn lock_collateral_for_offer_acceptances(
    prepared_accept_executions: &[PreparedAcceptExecution],
    accept_journal_entry_id: u64,
) -> Result<Vec<LockedCollateralReservation>, VolumetricError> {
    let mut locked_collateral_reservations: Vec<LockedCollateralReservation> =
        Vec::with_capacity(prepared_accept_executions.len());

    for prepared_accept_execution in prepared_accept_executions {
        let collateral_to_lock_sats = prepared_accept_execution.quantity_sats;

        if let Err(error) =
            lock_collateral(prepared_accept_execution.writer, collateral_to_lock_sats)
        {
            rollback_locked_collateral_states_and_offers(&locked_collateral_reservations);
            fail_accept(
                accept_journal_entry_id,
                format!("lock_collateral failed: {:?}", error),
            );
            return Err(VolumetricError::from_def(
                error_codes::INSUFFICIENT_BALANCE,
                Some(&format!(
                    "available: {}, required: {}",
                    error.available, error.required
                )),
                None,
            ));
        }

        let mut offer_to_update = get_offer(prepared_accept_execution.offer_id).unwrap();
        offer_to_update.remaining_quantity = offer_to_update
            .remaining_quantity
            .saturating_sub(prepared_accept_execution.quantity_sats);
        offer_to_update.status = OfferStatus::Processing;
        update_offer(offer_to_update);

        locked_collateral_reservations.push(LockedCollateralReservation {
            writer: prepared_accept_execution.writer,
            collateral_locked_sats: collateral_to_lock_sats,
            offer_id: prepared_accept_execution.offer_id,
            original_remaining_quantity_sats: prepared_accept_execution
                .original_remaining_quantity_sats,
            original_status: prepared_accept_execution.original_status,
        });
    }

    Ok(locked_collateral_reservations)
}

fn rollback_locked_collateral_states_and_offers(
    locked_collateral_reservations: &[LockedCollateralReservation],
) {
    for locked_collateral_reservation in locked_collateral_reservations {
        let _ = unlock_collateral(
            locked_collateral_reservation.writer,
            locked_collateral_reservation.collateral_locked_sats,
        );

        if let Some(mut offer_to_restore) = get_offer(locked_collateral_reservation.offer_id) {
            offer_to_restore.remaining_quantity =
                locked_collateral_reservation.original_remaining_quantity_sats;
            offer_to_restore.status = locked_collateral_reservation.original_status;
            update_offer(offer_to_restore);
        }
    }
}

fn debit_buyer_available_balance(
    buyer_principal: Principal,
    total_buyer_debit_required_sats: u64,
    accept_journal_entry_id: u64,
    locked_collateral_reservations: &[LockedCollateralReservation],
) -> Result<(), VolumetricError> {
    if let Err(error) = subtract_available(buyer_principal, total_buyer_debit_required_sats) {
        rollback_locked_collateral_states_and_offers(locked_collateral_reservations);
        fail_accept(
            accept_journal_entry_id,
            format!("subtract_available failed: {:?}", error),
        );
        return Err(VolumetricError::from_def(
            error_codes::INSUFFICIENT_BALANCE,
            Some(&format!(
                "available: {}, required: {}",
                error.available, error.required
            )),
            None,
        ));
    }

    Ok(())
}

const OFFER_ID_SIZE: usize = size_of::<u64>();
const QUANTITY_SIZE: usize = size_of::<u64>();
const ACCEPT_ITEM_BYTES_SIZE: usize = OFFER_ID_SIZE + QUANTITY_SIZE;

fn accept_operation_id(
    buyer: Principal,
    accept_offer_items: &[AcceptOfferItem],
    request_nonce: u64,
) -> OperationId {
    let nonce_bytes = request_nonce.to_be_bytes();

    let accept_item_bytes: Vec<[u8; ACCEPT_ITEM_BYTES_SIZE]> = accept_offer_items
        .iter()
        .map(|accept_offer_item| {
            let mut encoded_accept_item = [0u8; ACCEPT_ITEM_BYTES_SIZE];
            encoded_accept_item[..OFFER_ID_SIZE]
                .copy_from_slice(&accept_offer_item.offer_id.to_be_bytes());
            encoded_accept_item[OFFER_ID_SIZE..]
                .copy_from_slice(&accept_offer_item.quantity.to_be_bytes());
            encoded_accept_item
        })
        .collect();

    let mut hash_input_parts: Vec<&[u8]> = Vec::with_capacity(accept_item_bytes.len() + 1);
    hash_input_parts.push(&nonce_bytes);
    for accept_item in &accept_item_bytes {
        hash_input_parts.push(accept_item);
    }

    OperationId::from_principal_bytes("accept", buyer, &hash_input_parts)
}

fn is_offer_status_acceptable_for_acceptance(status: OfferStatus) -> bool {
    matches!(status, OfferStatus::Open | OfferStatus::PartiallyFilled)
}

fn build_accept_receipt_from_wal_entry(
    operation_id: OperationId,
    wal_entry: &WalEntry,
) -> Result<AcceptOffersReceipt, VolumetricError> {
    let WalPayload::Accept(payload) = &wal_entry.payload else {
        return Err(VolumetricError::from_def(
            error_codes::INTERNAL_ERROR,
            Some("accept receipt loaded from unexpected wal payload"),
            None,
        ));
    };

    Ok(AcceptOffersReceipt {
        operation_id,
        accept_journal_entry_id: payload.accept_journal_entry_id,
        fill_group_id: payload.fill_group_id,
    })
}

fn load_accept_journal_entry(
    accept_journal_entry_id: u64,
) -> Result<crate::storage::PendingAccept, VolumetricError> {
    get_accept(accept_journal_entry_id).ok_or_else(|| {
        VolumetricError::from_def(
            error_codes::INTERNAL_ERROR,
            Some("accept journal entry not found"),
            None,
        )
    })
}

// Starts WAL execution asynchronously on-canister and is a no-op in native tests.
fn schedule_accept_wal_execution(operation_id: OperationId) {
    #[cfg(target_arch = "wasm32")]
    ic_cdk::futures::spawn(async move {
        let _ = crate::journaling::execute_wal_entry_now(operation_id).await;
    });

    #[cfg(not(target_arch = "wasm32"))]
    let _ = operation_id;
}

fn load_failed_accept_message(
    accept_journal_entry_id: u64,
    wal_last_error: Option<String>,
) -> Result<String, VolumetricError> {
    if let Some(pending_accept) = get_accept(accept_journal_entry_id) {
        if let AcceptPhase::Failed { reason } = pending_accept.phase {
            return Ok(reason);
        }
    }

    wal_last_error.ok_or_else(|| {
        VolumetricError::from_def(
            error_codes::INTERNAL_ERROR,
            Some("failed accept missing error message"),
            None,
        )
    })
}

fn load_accept_wal_result(operation_id: OperationId) -> Result<AcceptWalResult, VolumetricError> {
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

    match wal_result {
        WalResult::Accept(result) => Ok(result),
        _ => Err(VolumetricError::from_def(
            error_codes::INTERNAL_ERROR,
            Some("accept completed with unexpected wal result type"),
            None,
        )),
    }
}

fn build_accept_result(
    accept_wal_result: AcceptWalResult,
) -> Result<AcceptOffersResult, VolumetricError> {
    Ok(AcceptOffersResult {
        active_options: load_active_options_by_ids(&accept_wal_result.option_ids)?,
        fill_group_id: accept_wal_result.fill_group_id,
    })
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
