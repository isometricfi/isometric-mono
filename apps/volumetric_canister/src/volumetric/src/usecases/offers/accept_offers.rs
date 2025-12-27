use candid::Principal;
use icrc_ledger_types::icrc1::account::Account;

use crate::auth::derive_subaccount;
use crate::errors::VolumetricError;
use crate::guards::{validate_offer_params, OfferParams};
use crate::locks::AcceptLock;
use crate::oracle::get_btc_usd_price_cents;
use crate::storage::{
    add_available, add_platform_fee, calculate_platform_fee, calculate_premium,
    calculate_strike_price, get_balance, get_offer, get_platform_fee_recipient,
    insert_active_option, lock_collateral, next_id, subtract_available, unlock_collateral,
    update_offer, ActiveOption, ActiveOptionStatus, Asset, Config, CounterKey, OfferStatus,
    OptionType, CKBTC_TRANSFER_FEE,
};

use crate::usecases::balances::transfer_ckbtc;

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
    platform_fee: u64,
    option_id: u64,
    expiry: u64,
    original_remaining_quantity: u64,
    original_status: OfferStatus,
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

    if items.is_empty() {
        return Err(VolumetricError::internal("No items to accept"));
    }

    if items.len() > 1 && !Config::is_stitching_enabled() {
        return Err(VolumetricError::stitching_disabled());
    }

    let now = ic_cdk::api::time();
    let fill_group_id = next_id(CounterKey::FillGroupId);
    let entry_price_cents = get_btc_usd_price_cents()?;

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
            let mut updated_offer = offer.clone();
            updated_offer.status = OfferStatus::Cancelled;
            update_offer(updated_offer);
            return Err(VolumetricError::insufficient_balance(
                writer_balance.available,
                item.quantity,
            ));
        }

        let premium = calculate_premium(item.quantity, offer.premium_basis_points);
        let platform_fee = calculate_platform_fee(premium);
        let premium_to_writer = premium.saturating_sub(platform_fee);

        let num_transfers: u64 = if platform_fee > 0 { 2 } else { 1 };
        let transfer_fees = num_transfers * CKBTC_TRANSFER_FEE;
        let total_cost = premium.saturating_add(transfer_fees);
        total_premium_required = total_premium_required.saturating_add(total_cost);

        let option_id = next_id(CounterKey::ActiveOptionId);

        let duration_nanos = offer
            .option_duration_seconds
            .checked_mul(1_000_000_000)
            .ok_or_else(|| VolumetricError::internal("Option duration overflow"))?;
        let expiry = now
            .checked_add(duration_nanos)
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

        if platform_fee > 0 {
            pending_transfers.push(PendingTransfer {
                from_subaccount: Some(buyer_subaccount),
                to: Account {
                    owner: get_platform_fee_recipient(),
                    subaccount: None,
                },
                amount: platform_fee,
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
            platform_fee,
            option_id,
            expiry,
            original_remaining_quantity: offer.remaining_quantity,
            original_status: offer.status,
        });
    }

    let buyer_balance = get_balance(&buyer_principal);
    if buyer_balance.available < total_premium_required {
        return Err(VolumetricError::insufficient_balance(
            buyer_balance.available,
            total_premium_required,
        ));
    }

    let mut locked_states: Vec<LockedState> = Vec::with_capacity(validated.len());

    for v in &validated {
        let collateral_to_lock = v.quantity;

        if let Err(e) = lock_collateral(v.writer, collateral_to_lock) {
            rollback_locks(&locked_states);
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

    if let Err(e) = subtract_available(buyer_principal, total_premium_required) {
        rollback_locks(&locked_states);
        return Err(VolumetricError::insufficient_balance(
            e.available,
            e.required,
        ));
    }

    for transfer in pending_transfers {
        if let Err(e) = transfer_ckbtc(transfer.from_subaccount, transfer.to, transfer.amount).await
        {
            rollback_locks(&locked_states);
            add_available(buyer_principal, total_premium_required);
            return Err(e);
        }
    }

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
        };

        add_available(v.writer, v.premium_to_writer);
        add_platform_fee(v.platform_fee);
        insert_active_option(active_option.clone());

        let mut offer = get_offer(v.offer_id).unwrap();
        if offer.remaining_quantity == 0 {
            offer.status = OfferStatus::Filled;
        } else {
            offer.status = OfferStatus::PartiallyFilled;
        }
        update_offer(offer);

        active_options.push(active_option);
    }

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
