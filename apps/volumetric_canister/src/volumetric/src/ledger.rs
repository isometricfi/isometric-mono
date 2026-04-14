/// Wraps ckBTC ledger inter-canister calls behind a swappable implementation.
///
/// - Production: calls go through [`IcLedger`] → `ic_cdk` inter-canister calls.
/// - Tests: call [`set_ledger`] to swap in a mock. `set_ledger` is
///   `#[cfg(test)]` so it doesn't exist in the production binary.
use std::cell::RefCell;
use std::rc::Rc;

use async_trait::async_trait;
use candid::Nat;
use icrc_ledger_types::icrc1::account::Account;
use icrc_ledger_types::icrc1::transfer::TransferError;
use icrc_ledger_types::icrc2::approve::{ApproveArgs, ApproveError};

use crate::errors::{error_codes, VolumetricError};
use crate::ic;
use crate::storage::Config;

const TRANSFER_FEE_CACHE_TTL_90_SECONDS_NS: u64 = 90_000_000_000;
#[cfg(any(test, feature = "testing"))]
pub const TESTING_CKBTC_TRANSFER_FEE_SATS: u64 = 10;

/// ckBTC withdrawal uses `icrc2_approve` then a minter-triggered `transfer_from`; each charges
/// one `icrc1_fee` from the user's subaccount balance.
pub const CKBTC_WITHDRAW_ICRC2_LEDGER_FEE_CHARGE_COUNT: u64 = 2;

#[derive(Clone, Copy)]
struct TransferFeeCacheEntry {
    fee_sats: u64,
    fetched_at_ns: u64,
}

#[async_trait(?Send)]
pub trait LedgerClient {
    async fn icrc1_transfer(
        &self,
        from_subaccount: Option<[u8; 32]>,
        to: Account,
        amount: u64,
        created_at_time: u64,
    ) -> Result<u64, VolumetricError>;

    async fn icrc1_balance_of(&self, account: Account) -> Result<Nat, VolumetricError>;

    async fn icrc2_approve(&self, args: ApproveArgs) -> Result<Nat, VolumetricError>;

    async fn icrc1_fee(&self) -> Result<u64, VolumetricError>;
}

/// Production implementation — delegates to ckBTC ledger via `ic_cdk`.
struct IcLedger;

fn nat_to_u64_or_error(value: Nat, context: &str) -> Result<u64, VolumetricError> {
    value.0.try_into().map_err(|_| {
        VolumetricError::from_def(
            error_codes::INTER_CANISTER_CALL_FAILED,
            Some(&format!("{}: block index does not fit into u64", context)),
            None,
        )
    })
}

#[async_trait(?Send)]
impl LedgerClient for IcLedger {
    async fn icrc1_transfer(
        &self,
        from_subaccount: Option<[u8; 32]>,
        to: Account,
        amount: u64,
        created_at_time: u64,
    ) -> Result<u64, VolumetricError> {
        let ledger = Config::ckbtc_ledger();

        let args = icrc_ledger_types::icrc1::transfer::TransferArg {
            from_subaccount,
            to,
            amount: Nat::from(amount),
            fee: None,
            memo: None,
            created_at_time: Some(created_at_time),
        };

        let response = ic_cdk::call::Call::bounded_wait(ledger, "icrc1_transfer")
            .with_arg(&args)
            .await
            .map_err(|e| {
                VolumetricError::from_def(
                    error_codes::INTER_CANISTER_CALL_FAILED,
                    Some(&format!("icrc1_transfer (bounded_wait): {:?}", e)),
                    None,
                )
            })?;

        let result: Result<Nat, TransferError> = response.candid().map_err(|e| {
            VolumetricError::from_def(
                error_codes::INTER_CANISTER_CALL_FAILED,
                Some(&format!("icrc1_transfer decode: {:?}", e)),
                None,
            )
        })?;

        match result {
            Ok(block_index) => nat_to_u64_or_error(block_index, "icrc1_transfer"),
            Err(TransferError::Duplicate { duplicate_of }) => {
                nat_to_u64_or_error(duplicate_of, "icrc1_transfer duplicate")
            }
            Err(e) => Err(VolumetricError::from_def(
                error_codes::INTER_CANISTER_CALL_FAILED,
                Some(&format!("icrc1_transfer rejected: {:?}", e)),
                None,
            )),
        }
    }

    async fn icrc1_balance_of(&self, account: Account) -> Result<Nat, VolumetricError> {
        let ledger = Config::ckbtc_ledger();

        let response = ic_cdk::call::Call::bounded_wait(ledger, "icrc1_balance_of")
            .with_arg(account)
            .await
            .map_err(|e| {
                VolumetricError::from_def(
                    error_codes::INTER_CANISTER_CALL_FAILED,
                    Some(&format!("icrc1_balance_of (bounded_wait): {:?}", e)),
                    None,
                )
            })?;

        let balance: Nat = response.candid().map_err(|e| {
            VolumetricError::from_def(
                error_codes::INTER_CANISTER_CALL_FAILED,
                Some(&format!("icrc1_balance_of decode: {:?}", e)),
                None,
            )
        })?;

        Ok(balance)
    }

    async fn icrc2_approve(&self, args: ApproveArgs) -> Result<Nat, VolumetricError> {
        let ledger = Config::ckbtc_ledger();

        let response = ic_cdk::call::Call::bounded_wait(ledger, "icrc2_approve")
            .with_arg(&args)
            .await
            .map_err(|e| {
                VolumetricError::from_def(
                    error_codes::INTER_CANISTER_CALL_FAILED,
                    Some(&format!("icrc2_approve (bounded_wait): {:?}", e)),
                    None,
                )
            })?;

        let result: Result<Nat, ApproveError> = response.candid().map_err(|e| {
            VolumetricError::from_def(
                error_codes::INTER_CANISTER_CALL_FAILED,
                Some(&format!("icrc2_approve decode: {:?}", e)),
                None,
            )
        })?;

        match result {
            Ok(block_index) => Ok(block_index),
            Err(ApproveError::Duplicate { duplicate_of: _ }) => Ok(Nat::from(0u64)),
            Err(e) => Err(VolumetricError::from_def(
                error_codes::INTER_CANISTER_CALL_FAILED,
                Some(&format!("icrc2_approve rejected: {:?}", e)),
                None,
            )),
        }
    }

    async fn icrc1_fee(&self) -> Result<u64, VolumetricError> {
        let ledger = Config::ckbtc_ledger();

        let response = ic_cdk::call::Call::bounded_wait(ledger, "icrc1_fee")
            .with_arg(())
            .await
            .map_err(|e| {
                VolumetricError::from_def(
                    error_codes::INTER_CANISTER_CALL_FAILED,
                    Some(&format!("icrc1_fee (bounded_wait): {:?}", e)),
                    None,
                )
            })?;

        let fee: Nat = response.candid().map_err(|e| {
            VolumetricError::from_def(
                error_codes::INTER_CANISTER_CALL_FAILED,
                Some(&format!("icrc1_fee decode: {:?}", e)),
                None,
            )
        })?;

        nat_to_u64_or_error(fee, "icrc1_fee")
    }
}

thread_local! {
    static LEDGER: RefCell<Rc<dyn LedgerClient>> = RefCell::new(Rc::new(IcLedger));
    static TRANSFER_FEE_CACHE: RefCell<Option<TransferFeeCacheEntry>> = const { RefCell::new(None) };
    static TRANSFER_FEE_REFRESH_IN_FLIGHT: RefCell<bool> = const { RefCell::new(false) };
}

pub async fn icrc1_transfer(
    from_subaccount: Option<[u8; 32]>,
    to: Account,
    amount: u64,
    created_at_time: u64,
) -> Result<u64, VolumetricError> {
    let ledger = LEDGER.with(|l| Rc::clone(&l.borrow()));
    ledger
        .icrc1_transfer(from_subaccount, to, amount, created_at_time)
        .await
}

pub async fn icrc1_balance_of(account: Account) -> Result<Nat, VolumetricError> {
    let ledger = LEDGER.with(|l| Rc::clone(&l.borrow()));
    ledger.icrc1_balance_of(account).await
}

pub async fn icrc2_approve(args: ApproveArgs) -> Result<Nat, VolumetricError> {
    let ledger = LEDGER.with(|l| Rc::clone(&l.borrow()));
    ledger.icrc2_approve(args).await
}

pub fn get_cached_icrc1_transfer_fee_sats_for_sync_flow() -> Result<u64, VolumetricError> {
    let now_ns = ic::time();
    if let Some(fee_sats) = load_fresh_transfer_fee_sats(now_ns) {
        return Ok(fee_sats);
    }

    schedule_transfer_fee_refresh_if_idle();
    Err(VolumetricError::from_def(
        error_codes::CONFIG_ERROR,
        Some("ckbtc transfer fee cache stale; retry shortly"),
        None,
    ))
}

pub fn withdraw_ckbtc_ledger_fee_reserve_sats_for_transfer_fee(transfer_fee_sats: u64) -> u64 {
    transfer_fee_sats.saturating_mul(CKBTC_WITHDRAW_ICRC2_LEDGER_FEE_CHARGE_COUNT)
}

/// Maximum `WithdrawParams.amount` (gross internal debit) the user can submit for ckBTC withdraw.
pub fn max_gross_withdraw_sats_for_available_balance(
    available_sats: u64,
    transfer_fee_sats: u64,
    minimum_net_withdraw_amount_sats: u64,
) -> u64 {
    let ledger_fee_reserve_sats =
        withdraw_ckbtc_ledger_fee_reserve_sats_for_transfer_fee(transfer_fee_sats);
    let minimum_required_available_sats =
        minimum_net_withdraw_amount_sats.saturating_add(ledger_fee_reserve_sats);
    if available_sats < minimum_required_available_sats {
        return 0;
    }
    available_sats
}

pub fn schedule_transfer_fee_refresh_if_idle() {
    #[cfg(target_arch = "wasm32")]
    {
        if !ic_cdk::api::in_replicated_execution() {
            return;
        }

        ic_cdk::futures::spawn(async move {
            refresh_transfer_fee_cache_if_idle().await;
        });
    }
}

pub async fn refresh_transfer_fee_cache_if_idle() {
    #[cfg(target_arch = "wasm32")]
    if !ic_cdk::api::in_replicated_execution() {
        return;
    }

    if !mark_transfer_fee_refresh_in_flight_if_idle() {
        return;
    }

    if let Err(error) = refresh_transfer_fee_cache().await {
        ic::log(&format!("transfer fee cache refresh failed: {:?}", error));
    }
    clear_transfer_fee_refresh_in_flight();
}

pub async fn refresh_transfer_fee_cache() -> Result<u64, VolumetricError> {
    let fee_sats = fetch_icrc1_transfer_fee_sats().await?;
    let fetched_at_ns = ic::time();
    TRANSFER_FEE_CACHE.with(|cache| {
        *cache.borrow_mut() = Some(TransferFeeCacheEntry {
            fee_sats,
            fetched_at_ns,
        });
    });
    Ok(fee_sats)
}

async fn fetch_icrc1_transfer_fee_sats() -> Result<u64, VolumetricError> {
    let ledger = LEDGER.with(|l| Rc::clone(&l.borrow()));
    ledger.icrc1_fee().await
}

fn load_fresh_transfer_fee_sats(now_ns: u64) -> Option<u64> {
    TRANSFER_FEE_CACHE.with(|cache| {
        let cached_fee_entry = cache.borrow().as_ref().copied()?;
        let cache_age_ns = now_ns.saturating_sub(cached_fee_entry.fetched_at_ns);
        if cache_age_ns <= TRANSFER_FEE_CACHE_TTL_90_SECONDS_NS {
            return Some(cached_fee_entry.fee_sats);
        }
        None
    })
}

fn mark_transfer_fee_refresh_in_flight_if_idle() -> bool {
    TRANSFER_FEE_REFRESH_IN_FLIGHT.with(|refresh_in_flight| {
        let mut refresh_in_flight = refresh_in_flight.borrow_mut();
        if *refresh_in_flight {
            return false;
        }
        *refresh_in_flight = true;
        true
    })
}

fn clear_transfer_fee_refresh_in_flight() {
    TRANSFER_FEE_REFRESH_IN_FLIGHT.with(|refresh_in_flight| {
        *refresh_in_flight.borrow_mut() = false;
    });
}

/// Swap the ledger implementation (test-only, compiled out in production).
#[cfg(test)]
pub fn set_ledger(client: Rc<dyn LedgerClient>) {
    LEDGER.with(|l| *l.borrow_mut() = client);
}

#[cfg(any(test, feature = "testing"))]
pub fn set_cached_transfer_fee_for_testing(fee_sats: u64, fetched_at_ns: u64) {
    TRANSFER_FEE_CACHE.with(|cache| {
        *cache.borrow_mut() = Some(TransferFeeCacheEntry {
            fee_sats,
            fetched_at_ns,
        });
    });
}

#[cfg(any(test, feature = "testing"))]
pub fn clear_cached_transfer_fee_for_testing() {
    TRANSFER_FEE_CACHE.with(|cache| {
        *cache.borrow_mut() = None;
    });
    TRANSFER_FEE_REFRESH_IN_FLIGHT.with(|refresh_in_flight| {
        *refresh_in_flight.borrow_mut() = false;
    });
}

#[cfg(test)]
mod tests {
    use std::cell::RefCell;
    use std::rc::Rc;

    use async_trait::async_trait;
    use candid::Principal;
    use icrc_ledger_types::icrc1::account::Account;

    use super::*;
    use crate::ic::{self, IcRuntime};

    const TEST_NOW_NS: u64 = 1_000_000_000_000;
    const TEST_FEE_10_SATS: u64 = 10;
    const TEST_FEE_25_SATS: u64 = 25;

    struct MockRuntime {
        now_ns: u64,
    }

    impl IcRuntime for MockRuntime {
        fn time(&self) -> u64 {
            self.now_ns
        }

        fn canister_self(&self) -> Principal {
            Principal::anonymous()
        }

        fn log(&self, _message: &str) {}
    }

    struct FeeMockLedger {
        fee_results: RefCell<Vec<Result<u64, VolumetricError>>>,
        fee_call_count: RefCell<u64>,
    }

    impl FeeMockLedger {
        fn new(fee_results: Vec<Result<u64, VolumetricError>>) -> Self {
            Self {
                fee_results: RefCell::new(fee_results),
                fee_call_count: RefCell::new(0),
            }
        }
    }

    #[async_trait(?Send)]
    impl LedgerClient for FeeMockLedger {
        async fn icrc1_transfer(
            &self,
            _from_subaccount: Option<[u8; 32]>,
            _to: Account,
            _amount: u64,
            _created_at_time: u64,
        ) -> Result<u64, VolumetricError> {
            Ok(1)
        }

        async fn icrc1_balance_of(&self, _account: Account) -> Result<Nat, VolumetricError> {
            Ok(Nat::from(0u64))
        }

        async fn icrc2_approve(&self, _args: ApproveArgs) -> Result<Nat, VolumetricError> {
            Ok(Nat::from(0u64))
        }

        async fn icrc1_fee(&self) -> Result<u64, VolumetricError> {
            let mut fee_call_count = self.fee_call_count.borrow_mut();
            *fee_call_count = fee_call_count.saturating_add(1);
            self.fee_results.borrow_mut().remove(0)
        }
    }

    #[test]
    fn test_nat_to_u64_or_error_rejects_overflowing_value() {
        // given
        let overflowing_value = Nat::from(u128::MAX);

        // when
        let result = nat_to_u64_or_error(overflowing_value, "overflow test");

        // then
        assert!(result.is_err());
        let error = result.unwrap_err();
        assert_eq!(error.code, error_codes::INTER_CANISTER_CALL_FAILED.code);
    }

    #[test]
    fn test_nat_to_u64_or_error_accepts_u64_value() {
        // given
        let in_range_value = Nat::from(42u64);

        // when
        let result = nat_to_u64_or_error(in_range_value, "in-range test");

        // then
        assert!(result.is_ok());
        assert_eq!(result.expect("value should convert to u64"), 42);
    }

    #[test]
    fn test_get_cached_fee_returns_fresh_cached_value() {
        // given
        clear_cached_transfer_fee_for_testing();
        ic::set_runtime(Box::new(MockRuntime {
            now_ns: TEST_NOW_NS,
        }));
        set_cached_transfer_fee_for_testing(TEST_FEE_10_SATS, TEST_NOW_NS - 1);

        // when
        let fee_result = get_cached_icrc1_transfer_fee_sats_for_sync_flow();

        // then
        assert_eq!(fee_result.expect("fee should be fresh"), TEST_FEE_10_SATS);
    }

    #[test]
    fn test_get_cached_fee_returns_stale_error_when_cache_missing() {
        // given
        clear_cached_transfer_fee_for_testing();
        ic::set_runtime(Box::new(MockRuntime {
            now_ns: TEST_NOW_NS,
        }));

        // when
        let fee_result = get_cached_icrc1_transfer_fee_sats_for_sync_flow();

        // then
        let stale_error = fee_result.expect_err("missing cache should be stale");
        assert_eq!(stale_error.code, error_codes::CONFIG_ERROR.code);
    }

    /// Given: a cached transfer fee fetched exactly at the TTL boundary
    /// When: reading the transfer fee from the sync flow accessor
    /// Then: the cached value is still treated as fresh
    #[test]
    fn test_get_cached_fee_accepts_value_at_ttl_boundary() {
        // given
        clear_cached_transfer_fee_for_testing();
        ic::set_runtime(Box::new(MockRuntime {
            now_ns: TEST_NOW_NS,
        }));
        set_cached_transfer_fee_for_testing(
            TEST_FEE_10_SATS,
            TEST_NOW_NS - TRANSFER_FEE_CACHE_TTL_90_SECONDS_NS,
        );

        // when
        let fee_result = get_cached_icrc1_transfer_fee_sats_for_sync_flow();

        // then
        assert_eq!(
            fee_result.expect("fee should still be fresh"),
            TEST_FEE_10_SATS
        );
    }

    /// Given: a cached transfer fee older than TTL by one nanosecond
    /// When: reading the transfer fee from the sync flow accessor
    /// Then: the cache entry is rejected as stale
    #[test]
    fn test_get_cached_fee_rejects_value_older_than_ttl() {
        // given
        clear_cached_transfer_fee_for_testing();
        ic::set_runtime(Box::new(MockRuntime {
            now_ns: TEST_NOW_NS,
        }));
        set_cached_transfer_fee_for_testing(
            TEST_FEE_10_SATS,
            TEST_NOW_NS - TRANSFER_FEE_CACHE_TTL_90_SECONDS_NS - 1,
        );

        // when
        let fee_result = get_cached_icrc1_transfer_fee_sats_for_sync_flow();

        // then
        let stale_error = fee_result.expect_err("fee older than TTL should be stale");
        assert_eq!(stale_error.code, error_codes::CONFIG_ERROR.code);
    }

    #[tokio::test]
    async fn test_refresh_transfer_fee_cache_updates_cache() {
        // given
        clear_cached_transfer_fee_for_testing();
        ic::set_runtime(Box::new(MockRuntime {
            now_ns: TEST_NOW_NS,
        }));
        let mock_ledger = Rc::new(FeeMockLedger::new(vec![Ok(TEST_FEE_25_SATS)]));
        set_ledger(mock_ledger);

        // when
        let refresh_result = refresh_transfer_fee_cache().await;
        let cached_fee_result = get_cached_icrc1_transfer_fee_sats_for_sync_flow();

        // then
        assert_eq!(
            refresh_result.expect("refresh should succeed"),
            TEST_FEE_25_SATS
        );
        assert_eq!(
            cached_fee_result.expect("cached fee should be fresh"),
            TEST_FEE_25_SATS
        );
    }

    #[tokio::test]
    async fn test_refresh_transfer_fee_cache_propagates_ledger_error() {
        // given
        clear_cached_transfer_fee_for_testing();
        ic::set_runtime(Box::new(MockRuntime {
            now_ns: TEST_NOW_NS,
        }));
        let mock_ledger = Rc::new(FeeMockLedger::new(vec![Err(VolumetricError::from_def(
            error_codes::INTER_CANISTER_CALL_FAILED,
            Some("fee unavailable"),
            None,
        ))]));
        set_ledger(mock_ledger);

        // when
        let refresh_result = refresh_transfer_fee_cache().await;

        // then
        let refresh_error = refresh_result.expect_err("refresh should fail");
        assert_eq!(
            refresh_error.code,
            error_codes::INTER_CANISTER_CALL_FAILED.code
        );
    }

    /// Given: transfer fee refresh is already marked as in-flight
    /// When: refresh_transfer_fee_cache_if_idle is invoked again
    /// Then: the duplicate invocation is skipped and does not hit the ledger
    #[tokio::test]
    async fn test_refresh_transfer_fee_cache_if_idle_skips_when_in_flight() {
        // given
        clear_cached_transfer_fee_for_testing();
        ic::set_runtime(Box::new(MockRuntime {
            now_ns: TEST_NOW_NS,
        }));
        let mock_ledger = Rc::new(FeeMockLedger::new(vec![Ok(TEST_FEE_25_SATS)]));
        let mock_ledger_reference = Rc::clone(&mock_ledger);
        set_ledger(mock_ledger);
        assert!(mark_transfer_fee_refresh_in_flight_if_idle());

        // when
        refresh_transfer_fee_cache_if_idle().await;

        // then
        assert_eq!(*mock_ledger_reference.fee_call_count.borrow(), 0);
        clear_transfer_fee_refresh_in_flight();
    }

    /// Given: a refresh attempt fails due to an inter-canister error
    /// When: refresh_transfer_fee_cache_if_idle finishes
    /// Then: the in-flight guard is reset so a later refresh can proceed
    #[tokio::test]
    async fn test_refresh_transfer_fee_cache_if_idle_clears_in_flight_after_error() {
        // given
        clear_cached_transfer_fee_for_testing();
        ic::set_runtime(Box::new(MockRuntime {
            now_ns: TEST_NOW_NS,
        }));
        let mock_ledger = Rc::new(FeeMockLedger::new(vec![Err(VolumetricError::from_def(
            error_codes::INTER_CANISTER_CALL_FAILED,
            Some("fee fetch failed"),
            None,
        ))]));
        set_ledger(mock_ledger);

        // when
        refresh_transfer_fee_cache_if_idle().await;
        let can_mark_again = mark_transfer_fee_refresh_in_flight_if_idle();

        // then
        assert!(can_mark_again);
        clear_transfer_fee_refresh_in_flight();
    }

    #[tokio::test]
    async fn test_stale_cache_then_refresh_makes_fee_available() {
        // given
        clear_cached_transfer_fee_for_testing();
        ic::set_runtime(Box::new(MockRuntime {
            now_ns: TEST_NOW_NS,
        }));
        set_cached_transfer_fee_for_testing(
            TEST_FEE_10_SATS,
            TEST_NOW_NS - TRANSFER_FEE_CACHE_TTL_90_SECONDS_NS - 1,
        );
        let mock_ledger = Rc::new(FeeMockLedger::new(vec![Ok(TEST_FEE_25_SATS)]));
        set_ledger(mock_ledger);

        // when
        let stale_result = get_cached_icrc1_transfer_fee_sats_for_sync_flow();
        refresh_transfer_fee_cache_if_idle().await;
        let refreshed_result = get_cached_icrc1_transfer_fee_sats_for_sync_flow();

        // then
        assert!(stale_result.is_err());
        assert_eq!(
            refreshed_result.expect("fee should be refreshed"),
            TEST_FEE_25_SATS
        );
    }

    /// Given: available balance at least minimum net withdraw plus two ledger fees
    /// When: computing the max gross withdraw amount for that balance
    /// Then: the result is the full available balance
    #[test]
    fn test_max_gross_withdraw_sats_returns_available_when_threshold_met() {
        // given
        clear_cached_transfer_fee_for_testing();
        ic::set_runtime(Box::new(MockRuntime {
            now_ns: TEST_NOW_NS,
        }));
        set_cached_transfer_fee_for_testing(TEST_FEE_10_SATS, TEST_NOW_NS);
        const AVAILABLE_SATS: u64 = 1_000;
        const MINIMUM_NET_WITHDRAW_SATS: u64 = 900;

        // when
        let max_sats = max_gross_withdraw_sats_for_available_balance(
            AVAILABLE_SATS,
            TEST_FEE_10_SATS,
            MINIMUM_NET_WITHDRAW_SATS,
        );

        // then
        assert_eq!(max_sats, AVAILABLE_SATS);
    }

    /// Given: available balance below minimum net withdraw plus two ledger fees
    /// When: computing the max gross withdraw amount
    /// Then: the result is zero
    #[test]
    fn test_max_gross_withdraw_sats_returns_zero_when_available_below_threshold() {
        // given
        clear_cached_transfer_fee_for_testing();
        ic::set_runtime(Box::new(MockRuntime {
            now_ns: TEST_NOW_NS,
        }));
        set_cached_transfer_fee_for_testing(TEST_FEE_10_SATS, TEST_NOW_NS);
        const AVAILABLE_SATS: u64 = 1_000;
        const MINIMUM_NET_WITHDRAW_SATS: u64 = 990;

        // when
        let max_sats = max_gross_withdraw_sats_for_available_balance(
            AVAILABLE_SATS,
            TEST_FEE_10_SATS,
            MINIMUM_NET_WITHDRAW_SATS,
        );

        // then
        const EXPECTED_MAX_GROSS_WITHDRAW_SATS: u64 = 0;
        assert_eq!(max_sats, EXPECTED_MAX_GROSS_WITHDRAW_SATS);
    }
}
