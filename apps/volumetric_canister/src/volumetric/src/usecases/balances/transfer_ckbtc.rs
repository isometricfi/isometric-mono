use icrc_ledger_types::icrc1::account::Account;
use std::cell::RefCell;

use crate::errors::VolumetricError;
use crate::{ic, ledger};

const TRANSFER_FEE_CACHE_TTL_NS: u64 = 60_000_000_000;

#[derive(Clone, Copy)]
struct CachedTransferFee {
    fee: u64,
    fetched_at_ns: u64,
}

thread_local! {
    static TRANSFER_FEE_CACHE: RefCell<Option<CachedTransferFee>> = const { RefCell::new(None) };
}

pub async fn transfer_ckbtc(
    from_subaccount: Option<[u8; 32]>,
    to: Account,
    amount: u64,
    created_at_time: u64,
) -> Result<u64, VolumetricError> {
    ledger::icrc1_transfer(from_subaccount, to, amount, created_at_time, None).await
}

fn is_cache_fresh(now_ns: u64, fetched_at_ns: u64) -> bool {
    now_ns.saturating_sub(fetched_at_ns) <= TRANSFER_FEE_CACHE_TTL_NS
}

fn is_bad_fee_error(error: &VolumetricError) -> bool {
    error.message.contains("bad_fee")
}

async fn get_cached_transfer_fee(force_refresh: bool) -> Result<u64, VolumetricError> {
    let now_ns = ic::time();

    if !force_refresh {
        let cached_fee = TRANSFER_FEE_CACHE.with_borrow(|cache| {
            cache
                .as_ref()
                .filter(|cached| is_cache_fresh(now_ns, cached.fetched_at_ns))
                .map(|cached| cached.fee)
        });

        if let Some(cached_fee) = cached_fee {
            return Ok(cached_fee);
        }
    }

    let fee = ledger::icrc1_fee().await?;
    TRANSFER_FEE_CACHE.with_borrow_mut(|cache| {
        *cache = Some(CachedTransferFee {
            fee,
            fetched_at_ns: now_ns,
        });
    });

    Ok(fee)
}

pub async fn prefetch_ckbtc_transfer_fee() -> Result<u64, VolumetricError> {
    get_cached_transfer_fee(false).await
}

pub async fn transfer_ckbtc_with_cached_fee_retry(
    from_subaccount: Option<[u8; 32]>,
    to: Account,
    amount: u64,
    created_at_time: u64,
) -> Result<u64, VolumetricError> {
    let cached_fee = get_cached_transfer_fee(false).await?;
    let first_attempt = ledger::icrc1_transfer(
        from_subaccount,
        to,
        amount,
        created_at_time,
        Some(cached_fee),
    )
    .await;

    if let Err(error) = first_attempt {
        if !is_bad_fee_error(&error) {
            return Err(error);
        }

        let refreshed_fee = get_cached_transfer_fee(true).await?;
        return ledger::icrc1_transfer(
            from_subaccount,
            to,
            amount,
            created_at_time,
            Some(refreshed_fee),
        )
        .await;
    }

    first_attempt
}

#[cfg(test)]
pub fn testing_set_transfer_fee_cache(fee: u64, fetched_at_ns: u64) {
    TRANSFER_FEE_CACHE.with_borrow_mut(|cache| {
        *cache = Some(CachedTransferFee { fee, fetched_at_ns });
    });
}

#[cfg(test)]
pub fn testing_clear_transfer_fee_cache() {
    TRANSFER_FEE_CACHE.with_borrow_mut(|cache| {
        *cache = None;
    });
}
