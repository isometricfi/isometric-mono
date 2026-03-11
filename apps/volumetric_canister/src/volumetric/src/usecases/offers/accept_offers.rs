use candid::Principal;
use icrc_ledger_types::icrc1::account::Account;

use crate::auth::derive_subaccount;
use crate::errors::VolumetricError;
use crate::guards::{validate_offer_params, OfferParams};
use crate::ic;
use crate::locks::AcceptLock;
use crate::oracle::get_btc_usd_price_cents;
use crate::storage::{
    add_available, add_platform_fee, calculate_premium, calculate_premium_fee,
    calculate_strike_price, complete_accept, create_accept, emit_event, fail_accept, get_balance,
    get_fee_recipient, get_offer, insert_active_option, lock_collateral, next_id, remove_accept,
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

struct PreparedAcceptBatch {
    prepared_accepts: Vec<PreparedAccept>,
    total_premium_required: u64,
    pending_premium_transfers: Vec<PendingPremiumTransfer>,
}

struct PreparedAccept {
    offer_id: u64,
    writer: Principal,
    asset: Asset,
    option_type: OptionType,
    strike_basis_points: u16,
    quantity: u64,
    premium: u64,
    premium_to_writer: u64,
    premium_fee: u64,
    option_id: u64,
    expiry: u64,
    original_remaining_quantity: u64,
    original_status: OfferStatus,
    profit_fee_basis_points: u64,
}

struct PendingPremiumTransfer {
    from_subaccount: Option<[u8; 32]>,
    to: Account,
    amount: u64,
}

struct LockedCollateralState {
    writer: Principal,
    collateral_locked: u64,
    offer_id: u64,
    original_remaining_quantity: u64,
    original_status: OfferStatus,
}

pub async fn accept_offers_use_case(
    buyer_principal: Principal,
    accept_offer_items: Vec<AcceptOfferItem>,
) -> Result<AcceptOffersResult, VolumetricError> {
    // bind to _lock, not `let _ =` which drops immediately
    let _buyer_accept_lock = AcceptLock::new(buyer_principal)?;
    let transfer_created_at_time_ns = ic::time();

    if accept_offer_items.is_empty() {
        return Err(VolumetricError::internal("No items to accept"));
    }

    if accept_offer_items.len() > 1 && !Config::is_stitching_enabled() {
        return Err(VolumetricError::stitching_disabled());
    }

    let current_time_ns = ic::time();
    let entry_price_cents = get_btc_usd_price_cents().await?;
    let fill_group_id = next_id(CounterKey::FillGroupId);

    let prepared_accept_batch =
        prepare_accept_batch(buyer_principal, &accept_offer_items, current_time_ns)?;

    let buyer_balance = get_balance(&buyer_principal);
    if buyer_balance.available < prepared_accept_batch.total_premium_required {
        return Err(VolumetricError::insufficient_balance(
            buyer_balance.available,
            prepared_accept_batch.total_premium_required,
        ));
    }

    let accepted_offers = create_accepted_offers(&prepared_accept_batch.prepared_accepts);

    let accept_journal_entry = create_accept(
        buyer_principal,
        prepared_accept_batch.total_premium_required,
        accepted_offers,
        fill_group_id,
    );
    let accept_journal_entry_id = accept_journal_entry.id;

    let locked_collateral_states = lock_collateral_for_prepared_accepts(
        &prepared_accept_batch.prepared_accepts,
        accept_journal_entry_id,
    )?;

    update_accept_phase(accept_journal_entry_id, AcceptPhase::CollateralLocked);

    if let Err(e) = subtract_available(
        buyer_principal,
        prepared_accept_batch.total_premium_required,
    ) {
        rollback_locked_collateral_states(&locked_collateral_states);
        fail_accept(
            accept_journal_entry_id,
            format!("subtract_available failed: {:?}", e),
        );
        return Err(VolumetricError::insufficient_balance(
            e.available,
            e.required,
        ));
    }

    update_accept_phase(accept_journal_entry_id, AcceptPhase::BuyerDebited);

    await_pending_premium_transfers(
        buyer_principal,
        prepared_accept_batch.pending_premium_transfers,
        &locked_collateral_states,
        prepared_accept_batch.total_premium_required,
        accept_journal_entry_id,
        transfer_created_at_time_ns,
    )
    .await?;

    update_accept_phase(accept_journal_entry_id, AcceptPhase::TransfersComplete);

    let created_active_options = finalize_prepared_accepts(
        buyer_principal,
        &prepared_accept_batch.prepared_accepts,
        entry_price_cents,
        current_time_ns,
        fill_group_id,
    );

    complete_accept(accept_journal_entry_id);
    remove_accept(accept_journal_entry_id);

    Ok(AcceptOffersResult {
        active_options: created_active_options,
        fill_group_id,
    })
}

fn rollback_locked_collateral_states(locked_collateral_states: &[LockedCollateralState]) {
    for locked_collateral_state in locked_collateral_states {
        let _ = unlock_collateral(
            locked_collateral_state.writer,
            locked_collateral_state.collateral_locked,
        );

        if let Some(mut offer_to_restore) = get_offer(locked_collateral_state.offer_id) {
            offer_to_restore.remaining_quantity =
                locked_collateral_state.original_remaining_quantity;
            offer_to_restore.status = locked_collateral_state.original_status;
            update_offer(offer_to_restore);
        }
    }
}

fn prepare_accept_batch(
    buyer_principal: Principal,
    accept_offer_items: &[AcceptOfferItem],
    current_time_ns: u64,
) -> Result<PreparedAcceptBatch, VolumetricError> {
    let mut prepared_accepts: Vec<PreparedAccept> = Vec::with_capacity(accept_offer_items.len());
    let mut total_premium_required: u64 = 0;
    let mut pending_premium_transfers: Vec<PendingPremiumTransfer> = Vec::new();

    for accept_offer_item in accept_offer_items {
        let offer = get_offer(accept_offer_item.offer_id)
            .ok_or_else(|| VolumetricError::offer_not_found(accept_offer_item.offer_id))?;

        validate_offer_acceptance(buyer_principal, accept_offer_item, &offer, current_time_ns)?;

        let writer_available_balance = get_balance(&offer.writer);
        if writer_available_balance.available < accept_offer_item.quantity {
            let mut updated_offer = offer.clone();
            updated_offer.status = OfferStatus::Cancelled;
            update_offer(updated_offer);
            return Err(VolumetricError::insufficient_balance(
                writer_available_balance.available,
                accept_offer_item.quantity,
            ));
        }

        let platform_fee_config = Config::fee_config();
        let premium = calculate_premium(accept_offer_item.quantity, offer.premium_basis_points);
        let premium_fee = calculate_premium_fee(premium);
        let premium_to_writer = premium.saturating_sub(premium_fee);

        let premium_transfer_count: u64 = if premium_fee > 0 { 2 } else { 1 };
        let total_transfer_fees = premium_transfer_count * CKBTC_TRANSFER_FEE;
        let total_premium_and_transfer_fees = premium.saturating_add(total_transfer_fees);
        total_premium_required =
            total_premium_required.saturating_add(total_premium_and_transfer_fees);

        let active_option_id = next_id(CounterKey::ActiveOptionId);

        // Round up to next hour boundary, then add full duration.
        // This ensures users get at least their full duration and all expiries
        // land on hour boundaries for efficient batch settlement.
        let option_expiry_ns = calculate_expiry_ns(current_time_ns, offer.option_duration_seconds)
            .ok_or_else(|| VolumetricError::internal("Expiry timestamp overflow"))?;

        pending_premium_transfers.extend(create_pending_premium_transfers(
            buyer_principal,
            offer.writer,
            premium_to_writer,
            premium_fee,
        ));

        prepared_accepts.push(PreparedAccept {
            offer_id: offer.id,
            writer: offer.writer,
            asset: offer.asset,
            option_type: offer.option_type,
            strike_basis_points: offer.strike_basis_points,
            quantity: accept_offer_item.quantity,
            premium,
            premium_to_writer,
            premium_fee,
            option_id: active_option_id,
            expiry: option_expiry_ns,
            original_remaining_quantity: offer.remaining_quantity,
            original_status: offer.status,
            profit_fee_basis_points: platform_fee_config.profit_fee_basis_points,
        });
    }

    Ok(PreparedAcceptBatch {
        prepared_accepts,
        total_premium_required,
        pending_premium_transfers,
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
        return Err(VolumetricError::cannot_accept_own_offer());
    }

    if offer.status == OfferStatus::Cancelled {
        return Err(VolumetricError::offer_cancelled());
    }

    if offer.status == OfferStatus::Filled {
        return Err(VolumetricError::offer_filled());
    }

    if offer.status == OfferStatus::Processing {
        return Err(VolumetricError::offer_processing());
    }

    if offer.offer_valid_until <= current_time_ns {
        return Err(VolumetricError::offer_expired());
    }

    if accept_offer_item.quantity > offer.remaining_quantity {
        return Err(VolumetricError::quantity_exceeds_available(
            accept_offer_item.quantity,
            offer.remaining_quantity,
        ));
    }

    if accept_offer_item.quantity < offer.remaining_quantity
        && !Config::is_partial_filling_enabled()
    {
        return Err(VolumetricError::partial_filling_disabled());
    }

    Ok(())
}

fn create_pending_premium_transfers(
    buyer_principal: Principal,
    writer_principal: Principal,
    premium_to_writer: u64,
    premium_fee: u64,
) -> Vec<PendingPremiumTransfer> {
    let buyer_subaccount = derive_subaccount(buyer_principal);
    let writer_subaccount = derive_subaccount(writer_principal);
    let mut pending_premium_transfers = Vec::with_capacity(if premium_fee > 0 { 2 } else { 1 });

    pending_premium_transfers.push(PendingPremiumTransfer {
        from_subaccount: Some(buyer_subaccount),
        to: Account {
            owner: ic::canister_self(),
            subaccount: Some(writer_subaccount),
        },
        amount: premium_to_writer,
    });

    if premium_fee > 0 {
        pending_premium_transfers.push(PendingPremiumTransfer {
            from_subaccount: Some(buyer_subaccount),
            to: Account {
                owner: get_fee_recipient(),
                subaccount: None,
            },
            amount: premium_fee,
        });
    }

    pending_premium_transfers
}

fn create_accepted_offers(prepared_accepts: &[PreparedAccept]) -> Vec<AcceptedOffer> {
    prepared_accepts
        .iter()
        .map(|prepared_accept| AcceptedOffer {
            offer_id: prepared_accept.offer_id,
            writer: prepared_accept.writer,
            quantity: prepared_accept.quantity,
            collateral_locked: prepared_accept.quantity,
            premium_to_writer: prepared_accept.premium_to_writer,
            platform_fee: prepared_accept.premium_fee,
            option_id: prepared_accept.option_id,
        })
        .collect()
}

fn lock_collateral_for_prepared_accepts(
    prepared_accepts: &[PreparedAccept],
    accept_journal_entry_id: u64,
) -> Result<Vec<LockedCollateralState>, VolumetricError> {
    let mut locked_collateral_states: Vec<LockedCollateralState> =
        Vec::with_capacity(prepared_accepts.len());

    for prepared_accept in prepared_accepts {
        let collateral_to_lock = prepared_accept.quantity;

        if let Err(e) = lock_collateral(prepared_accept.writer, collateral_to_lock) {
            rollback_locked_collateral_states(&locked_collateral_states);
            fail_accept(
                accept_journal_entry_id,
                format!("lock_collateral failed: {:?}", e),
            );
            return Err(VolumetricError::insufficient_balance(
                e.available,
                e.required,
            ));
        }

        let mut offer_to_update = get_offer(prepared_accept.offer_id).unwrap();
        offer_to_update.remaining_quantity = offer_to_update
            .remaining_quantity
            .saturating_sub(prepared_accept.quantity);
        offer_to_update.status = OfferStatus::Processing;
        update_offer(offer_to_update);

        locked_collateral_states.push(LockedCollateralState {
            writer: prepared_accept.writer,
            collateral_locked: collateral_to_lock,
            offer_id: prepared_accept.offer_id,
            original_remaining_quantity: prepared_accept.original_remaining_quantity,
            original_status: prepared_accept.original_status,
        });
    }

    Ok(locked_collateral_states)
}

async fn await_pending_premium_transfers(
    buyer_principal: Principal,
    pending_premium_transfers: Vec<PendingPremiumTransfer>,
    locked_collateral_states: &[LockedCollateralState],
    total_premium_required: u64,
    accept_journal_entry_id: u64,
    transfer_created_at_time_ns: u64,
) -> Result<(), VolumetricError> {
    for pending_premium_transfer in pending_premium_transfers {
        if let Err(e) = transfer_ckbtc(
            pending_premium_transfer.from_subaccount,
            pending_premium_transfer.to,
            pending_premium_transfer.amount,
            transfer_created_at_time_ns,
        )
        .await
        {
            rollback_locked_collateral_states(locked_collateral_states);
            add_available(buyer_principal, total_premium_required);
            fail_accept(
                accept_journal_entry_id,
                format!("transfer_ckbtc failed: {:?}", e),
            );
            return Err(e);
        }
    }

    Ok(())
}

fn finalize_prepared_accepts(
    buyer_principal: Principal,
    prepared_accepts: &[PreparedAccept],
    entry_price_cents: u64,
    current_time_ns: u64,
    fill_group_id: u64,
) -> Vec<ActiveOption> {
    let mut created_active_options: Vec<ActiveOption> = Vec::with_capacity(prepared_accepts.len());

    for prepared_accept in prepared_accepts {
        let strike_price_cents =
            calculate_strike_price(entry_price_cents, prepared_accept.strike_basis_points);
        let created_active_option = ActiveOption {
            id: prepared_accept.option_id,
            offer_id: prepared_accept.offer_id,
            buyer: buyer_principal,
            writer: prepared_accept.writer,
            asset: prepared_accept.asset,
            option_type: prepared_accept.option_type,
            quantity: prepared_accept.quantity,
            entry_price_cents,
            strike_price_cents,
            premium_paid: prepared_accept.premium,
            accepted_at: current_time_ns,
            expiry: prepared_accept.expiry,
            status: ActiveOptionStatus::Active,
            fill_group_id: Some(fill_group_id),
            profit_fee_basis_points: prepared_accept.profit_fee_basis_points,
        };

        add_available(prepared_accept.writer, prepared_accept.premium_to_writer);
        add_platform_fee(prepared_accept.premium_fee);
        insert_active_option(created_active_option.clone());

        let mut offer_to_update = get_offer(prepared_accept.offer_id).unwrap();
        if offer_to_update.remaining_quantity == 0 {
            offer_to_update.status = OfferStatus::Filled;
        } else {
            offer_to_update.status = OfferStatus::PartiallyFilled;
        }
        update_offer(offer_to_update);

        emit_offer_accepted_events(
            buyer_principal,
            prepared_accept,
            entry_price_cents,
            strike_price_cents,
            fill_group_id,
        );

        created_active_options.push(created_active_option);
    }

    created_active_options
}

fn emit_offer_accepted_events(
    buyer_principal: Principal,
    prepared_accept: &PreparedAccept,
    entry_price_cents: u64,
    strike_price_cents: u64,
    fill_group_id: u64,
) {
    emit_event(
        buyer_principal,
        EventType::OfferAccepted,
        EventData::OfferAccepted {
            offer_id: prepared_accept.offer_id,
            option_id: prepared_accept.option_id,
            fill_group_id,
            counterparty: prepared_accept.writer,
            quantity_sats: prepared_accept.quantity,
            premium_sats: prepared_accept.premium,
            entry_price_cents,
            strike_price_cents,
            expiry_ns: prepared_accept.expiry,
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
            counterparty: buyer_principal,
            quantity_sats: prepared_accept.quantity,
            premium_sats: prepared_accept.premium,
            entry_price_cents,
            strike_price_cents,
            expiry_ns: prepared_accept.expiry,
            role: TradeRole::Writer,
        },
    );
}
