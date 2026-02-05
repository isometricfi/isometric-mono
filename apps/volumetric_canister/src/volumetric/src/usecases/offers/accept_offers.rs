use candid::Principal;
use icrc_ledger_types::icrc1::account::Account;

use crate::auth::derive_subaccount;
use crate::errors::VolumetricError;
use crate::guards::{validate_offer_params, OfferParams};
use crate::locks::AcceptLock;
use crate::oracle::get_btc_usd_price_cents;
use crate::storage::{
    add_available, add_platform_fee, calculate_premium, calculate_premium_fee,
    calculate_strike_price, complete_accept, create_accept, emit_event, fail_accept, get_balance,
    get_fee_recipient, get_offer, insert_active_option, lock_collateral, next_id, remove_accept,
    subtract_available, unlock_collateral, update_accept_phase, update_offer, AcceptPhase,
    AcceptedOffer, ActiveOption, ActiveOptionStatus, Asset, Config, CounterKey, EventData,
    EventType, OfferStatus, OptionType, TradeRole,
};
use crate::time::calculate_expiry_ns;

use crate::usecases::balances::{get_ckbtc_transfer_fee, transfer_ckbtc};

pub struct AcceptOfferItem {
    pub offer_id: u64,
    pub quantity: u64,
}

pub struct AcceptOffersResult {
    pub active_options: Vec<ActiveOption>,
    pub fill_group_id: u64,
}

struct ValidatedAccept {
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

struct PendingTransfer {
    from_subaccount: Option<[u8; 32]>,
    to: Account,
    amount: u64,
}

struct LockedState {
    writer: Principal,
    collateral_locked: u64,
    offer_id: u64,
    original_remaining_quantity: u64,
    original_status: OfferStatus,
}

pub async fn accept_offers_use_case(
    buyer_principal: Principal,
    items: Vec<AcceptOfferItem>,
) -> Result<AcceptOffersResult, VolumetricError> {
    // bind to _lock, not `let _ =` which drops immediately
    let _lock = AcceptLock::new(buyer_principal)?;
    let created_at_time = ic_cdk::api::time();

    if items.is_empty() {
        return Err(VolumetricError::internal("No items to accept"));
    }

    if items.len() > 1 && !Config::is_stitching_enabled() {
        return Err(VolumetricError::stitching_disabled());
    }

    let now = ic_cdk::api::time();
    let fill_group_id = next_id(CounterKey::FillGroupId);
    let entry_price_cents = get_btc_usd_price_cents()?;
    let transfer_fee = get_ckbtc_transfer_fee().await?;

    let mut validated: Vec<ValidatedAccept> = Vec::with_capacity(items.len());
    let mut total_premium_required: u64 = 0;
    let mut pending_transfers: Vec<PendingTransfer> = Vec::new();

    for item in &items {
        let offer = get_offer(item.offer_id)
            .ok_or_else(|| VolumetricError::offer_not_found(item.offer_id))?;

        // Validate the accept parameters against current trading limits
        validate_offer_params(&OfferParams {
            quantity: item.quantity,
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

        if offer.offer_valid_until <= now {
            return Err(VolumetricError::offer_expired());
        }

        if item.quantity > offer.remaining_quantity {
            return Err(VolumetricError::quantity_exceeds_available(
                item.quantity,
                offer.remaining_quantity,
            ));
        }

        if item.quantity < offer.remaining_quantity && !Config::is_partial_filling_enabled() {
            return Err(VolumetricError::partial_filling_disabled());
        }

        let writer_balance = get_balance(&offer.writer);
        if writer_balance.available < item.quantity {
            return Err(VolumetricError::insufficient_balance(
                writer_balance.available,
                item.quantity,
            ));
        }

        let fee_config = Config::fee_config();
        let premium = calculate_premium(item.quantity, offer.premium_basis_points);
        let premium_fee = calculate_premium_fee(premium);
        let premium_to_writer = premium.saturating_sub(premium_fee);

        let num_transfers: u64 = if premium_fee > 0 { 2 } else { 1 };
        let transfer_fees = num_transfers * transfer_fee;
        let total_cost = premium.saturating_add(transfer_fees);
        total_premium_required = total_premium_required.saturating_add(total_cost);

        let option_id = next_id(CounterKey::ActiveOptionId);

        // Round up to next hour boundary, then add full duration.
        // This ensures users get at least their full duration and all expiries
        // land on hour boundaries for efficient batch settlement.
        let expiry = calculate_expiry_ns(now, offer.option_duration_seconds)
            .ok_or_else(|| VolumetricError::internal("Expiry timestamp overflow"))?;

        let buyer_subaccount = derive_subaccount(buyer_principal);
        let writer_subaccount = derive_subaccount(offer.writer);

        pending_transfers.push(PendingTransfer {
            from_subaccount: Some(buyer_subaccount),
            to: Account {
                owner: ic_cdk::api::canister_self(),
                subaccount: Some(writer_subaccount),
            },
            amount: premium_to_writer,
        });

        if premium_fee > 0 {
            pending_transfers.push(PendingTransfer {
                from_subaccount: Some(buyer_subaccount),
                to: Account {
                    owner: get_fee_recipient(),
                    subaccount: None,
                },
                amount: premium_fee,
            });
        }

        validated.push(ValidatedAccept {
            offer_id: offer.id,
            writer: offer.writer,
            asset: offer.asset,
            option_type: offer.option_type,
            strike_basis_points: offer.strike_basis_points,
            quantity: item.quantity,
            premium,
            premium_to_writer,
            premium_fee,
            option_id,
            expiry,
            original_remaining_quantity: offer.remaining_quantity,
            original_status: offer.status,
            profit_fee_basis_points: fee_config.profit_fee_basis_points,
        });
    }

    let buyer_balance = get_balance(&buyer_principal);
    if buyer_balance.available < total_premium_required {
        return Err(VolumetricError::insufficient_balance(
            buyer_balance.available,
            total_premium_required,
        ));
    }

    let accepted_offers: Vec<AcceptedOffer> = validated
        .iter()
        .map(|v| AcceptedOffer {
            offer_id: v.offer_id,
            writer: v.writer,
            quantity: v.quantity,
            collateral_locked: v.quantity,
            premium_to_writer: v.premium_to_writer,
            platform_fee: v.premium_fee,
            option_id: v.option_id,
        })
        .collect();

    let journal_entry = create_accept(
        buyer_principal,
        total_premium_required,
        accepted_offers,
        fill_group_id,
    );
    let accept_id = journal_entry.id;

    let mut locked_states: Vec<LockedState> = Vec::with_capacity(validated.len());

    for v in &validated {
        let collateral_to_lock = v.quantity;

        if let Err(e) = lock_collateral(v.writer, collateral_to_lock) {
            rollback_locks(&locked_states);
            fail_accept(accept_id, format!("lock_collateral failed: {:?}", e));
            return Err(VolumetricError::insufficient_balance(
                e.available,
                e.required,
            ));
        }

        let mut offer = get_offer(v.offer_id).unwrap();
        offer.remaining_quantity = offer.remaining_quantity.saturating_sub(v.quantity);
        offer.status = OfferStatus::Processing;
        update_offer(offer);

        locked_states.push(LockedState {
            writer: v.writer,
            collateral_locked: collateral_to_lock,
            offer_id: v.offer_id,
            original_remaining_quantity: v.original_remaining_quantity,
            original_status: v.original_status,
        });
    }

    update_accept_phase(accept_id, AcceptPhase::CollateralLocked);

    if let Err(e) = subtract_available(buyer_principal, total_premium_required) {
        rollback_locks(&locked_states);
        fail_accept(accept_id, format!("subtract_available failed: {:?}", e));
        return Err(VolumetricError::insufficient_balance(
            e.available,
            e.required,
        ));
    }

    update_accept_phase(accept_id, AcceptPhase::BuyerDebited);

    for transfer in pending_transfers {
        if let Err(e) = transfer_ckbtc(
            transfer.from_subaccount,
            transfer.to,
            transfer.amount,
            created_at_time,
        )
        .await
        {
            rollback_locks(&locked_states);
            add_available(buyer_principal, total_premium_required);
            fail_accept(accept_id, format!("transfer_ckbtc failed: {:?}", e));
            return Err(e);
        }
    }

    update_accept_phase(accept_id, AcceptPhase::TransfersComplete);

    let mut active_options: Vec<ActiveOption> = Vec::with_capacity(validated.len());

    for v in validated.iter() {
        let strike_price_cents = calculate_strike_price(entry_price_cents, v.strike_basis_points);
        let active_option = ActiveOption {
            id: v.option_id,
            offer_id: v.offer_id,
            buyer: buyer_principal,
            writer: v.writer,
            asset: v.asset,
            option_type: v.option_type,
            quantity: v.quantity,
            entry_price_cents,
            strike_price_cents,
            premium_paid: v.premium,
            accepted_at: now,
            expiry: v.expiry,
            status: ActiveOptionStatus::Active,
            fill_group_id: Some(fill_group_id),
            profit_fee_basis_points: v.profit_fee_basis_points,
        };

        add_available(v.writer, v.premium_to_writer);
        add_platform_fee(v.premium_fee);
        insert_active_option(active_option.clone());

        let mut offer = get_offer(v.offer_id).unwrap();
        if offer.remaining_quantity == 0 {
            offer.status = OfferStatus::Filled;
        } else {
            offer.status = OfferStatus::PartiallyFilled;
        }
        update_offer(offer);

        emit_event(
            buyer_principal,
            EventType::OfferAccepted,
            EventData::OfferAccepted {
                offer_id: v.offer_id,
                option_id: v.option_id,
                fill_group_id,
                counterparty: v.writer,
                quantity_sats: v.quantity,
                premium_sats: v.premium,
                entry_price_cents,
                strike_price_cents,
                expiry_ns: v.expiry,
                role: TradeRole::Buyer,
            },
        );

        emit_event(
            v.writer,
            EventType::OfferAccepted,
            EventData::OfferAccepted {
                offer_id: v.offer_id,
                option_id: v.option_id,
                fill_group_id,
                counterparty: buyer_principal,
                quantity_sats: v.quantity,
                premium_sats: v.premium,
                entry_price_cents,
                strike_price_cents,
                expiry_ns: v.expiry,
                role: TradeRole::Writer,
            },
        );

        active_options.push(active_option);
    }

    complete_accept(accept_id);
    remove_accept(accept_id);

    Ok(AcceptOffersResult {
        active_options,
        fill_group_id,
    })
}

fn rollback_locks(locked_states: &[LockedState]) {
    for locked in locked_states {
        let _ = unlock_collateral(locked.writer, locked.collateral_locked);

        if let Some(mut offer) = get_offer(locked.offer_id) {
            offer.remaining_quantity = locked.original_remaining_quantity;
            offer.status = locked.original_status;
            update_offer(offer);
        }
    }
}
