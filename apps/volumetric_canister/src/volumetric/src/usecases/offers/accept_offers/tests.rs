use std::cell::{Cell, RefCell};
use std::rc::Rc;

use async_trait::async_trait;
use candid::{Nat, Principal};
use icrc_ledger_types::icrc1::account::Account;
use icrc_ledger_types::icrc1::transfer::Memo;
use icrc_ledger_types::icrc2::approve::ApproveArgs;
use tokio::sync::oneshot;
use tokio::task;

use super::accept_offers::validate_accept_offer_request;
use super::*;
use crate::errors::{error_codes, VolumetricError};
use crate::ic::{self, IcRuntime};
use crate::journaling::{
    get_entry, ledger_memo, principal_memo_part, u64_memo_part, LedgerMemoKind, WalPayload,
};
use crate::ledger::{self, LedgerClient, TESTING_CKBTC_TRANSFER_FEE_SATS};
use crate::oracle::{set_oracle, PriceOracle, StubOracle};
use crate::storage::{
    add_available, add_platform_fee, calculate_premium_fee, calculate_premium_in_sats,
    calculate_strike_price_in_cents, clear_active_options, clear_events, clear_offers,
    get_active_option, get_balance, get_offer, get_platform_fees_collected, insert_active_option,
    insert_offer, set_balance, update_accept_execution_snapshot, update_accept_phase, update_offer,
    AcceptPhase, ActiveOption, ActiveOptionStatus, Asset, Config, FeatureFlags, Offer, OfferStatus,
    OptionType, UserBalance,
};
use crate::usecases::{withdraw_ckbtc_use_case, WithdrawParams};

const TEST_NOW_NS: u64 = 1_000_000_000_000;
const TEST_NOW_SECONDS: u64 = TEST_NOW_NS / crate::time::NANOS_PER_SECOND;
const TEST_PRICE_CENTS: u64 = 10_000_000;
const TEST_OFFER_ID: u64 = 1;
const TEST_QUANTITY_SATS: u64 = 1_000_000;
const TEST_STRIKE_BPS: u16 = 500;
const TEST_PREMIUM_BPS: u16 = 100;
const TEST_DURATION_SECS: u64 = 86400 * 3;
const TEST_OFFER_VALID_FOR_NS: u64 = 60_000_000_000;
const TEST_OFFER_VALID_FOR_SECONDS: u64 = TEST_OFFER_VALID_FOR_NS / crate::time::NANOS_PER_SECOND;
const TEST_BUYER_AVAILABLE_SATS: u64 = 200_000;
const TEST_BLOCK_INDEX: u64 = 42;
const STALE_TRANSFER_FEE_FETCHED_AT_SECONDS: u64 = TEST_NOW_SECONDS - 91;

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
        _expected_fee_sats: u64,
        _created_at_time: u64,
        _memo: Option<Memo>,
    ) -> Result<u64, VolumetricError> {
        let completed_transfer_count = self.completed_transfer_count.get();
        self.completed_transfer_count
            .set(completed_transfer_count + 1);

        if completed_transfer_count == 0 {
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

    async fn icrc1_fee(&self) -> Result<u64, VolumetricError> {
        Ok(TESTING_CKBTC_TRANSFER_FEE_SATS)
    }
}

struct SecondTransferFailsLedger {
    completed_transfer_count: Cell<u64>,
    transfer_memos: RefCell<Vec<Option<Memo>>>,
}

#[async_trait(?Send)]
impl LedgerClient for SecondTransferFailsLedger {
    async fn icrc1_transfer(
        &self,
        _from_subaccount: Option<[u8; 32]>,
        _to: Account,
        _amount: u64,
        _expected_fee_sats: u64,
        _created_at_time: u64,
        memo: Option<Memo>,
    ) -> Result<u64, VolumetricError> {
        let completed_transfer_count = self.completed_transfer_count.get();
        self.completed_transfer_count
            .set(completed_transfer_count + 1);
        self.transfer_memos.borrow_mut().push(memo);

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

    async fn icrc1_fee(&self) -> Result<u64, VolumetricError> {
        Ok(TESTING_CKBTC_TRANSFER_FEE_SATS)
    }
}

struct RecordingAcceptOracle {
    cache_first_price_cents: u64,
    fresh_price_result: Result<u64, VolumetricError>,
    cache_first_call_count: Rc<Cell<u64>>,
    fresh_call_count: Rc<Cell<u64>>,
    settlement_call_count: Rc<Cell<u64>>,
}

struct RecordingAcceptOracleCalls {
    cache_first_call_count: Rc<Cell<u64>>,
    fresh_call_count: Rc<Cell<u64>>,
    settlement_call_count: Rc<Cell<u64>>,
}

impl RecordingAcceptOracle {
    fn new(
        cache_first_price_cents: u64,
        fresh_price_cents: u64,
    ) -> (Self, RecordingAcceptOracleCalls) {
        Self::new_with_fresh_result(cache_first_price_cents, Ok(fresh_price_cents))
    }

    fn new_with_fresh_failure(cache_first_price_cents: u64) -> (Self, RecordingAcceptOracleCalls) {
        Self::new_with_fresh_result(
            cache_first_price_cents,
            Err(VolumetricError::from_def(
                error_codes::INTER_CANISTER_CALL_FAILED,
                Some("fresh XRC unavailable"),
                None,
            )),
        )
    }

    fn new_with_fresh_result(
        cache_first_price_cents: u64,
        fresh_price_result: Result<u64, VolumetricError>,
    ) -> (Self, RecordingAcceptOracleCalls) {
        let cache_first_call_count = Rc::new(Cell::new(0));
        let fresh_call_count = Rc::new(Cell::new(0));
        let settlement_call_count = Rc::new(Cell::new(0));

        (
            Self {
                cache_first_price_cents,
                fresh_price_result,
                cache_first_call_count: Rc::clone(&cache_first_call_count),
                fresh_call_count: Rc::clone(&fresh_call_count),
                settlement_call_count: Rc::clone(&settlement_call_count),
            },
            RecordingAcceptOracleCalls {
                cache_first_call_count,
                fresh_call_count,
                settlement_call_count,
            },
        )
    }

    fn record_cache_first_price_cents(&self) -> u64 {
        self.cache_first_call_count
            .set(self.cache_first_call_count.get().saturating_add(1));
        self.cache_first_price_cents
    }
}

#[async_trait(?Send)]
impl PriceOracle for RecordingAcceptOracle {
    async fn get_btc_usd_price_cents(&self) -> Result<u64, VolumetricError> {
        Ok(self.record_cache_first_price_cents())
    }

    async fn get_accept_btc_usd_price_cents(&self) -> Result<u64, VolumetricError> {
        self.fresh_call_count
            .set(self.fresh_call_count.get().saturating_add(1));
        match &self.fresh_price_result {
            Ok(fresh_price_cents) => Ok(*fresh_price_cents),
            Err(_) => Ok(self.record_cache_first_price_cents()),
        }
    }

    async fn get_settlement_btc_usd_price_cents(
        &self,
        _expiry_timestamp_seconds: u64,
    ) -> Result<u64, VolumetricError> {
        self.settlement_call_count
            .set(self.settlement_call_count.get().saturating_add(1));
        self.fresh_price_result.clone()
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
    ledger::set_cached_transfer_fee_for_testing(TESTING_CKBTC_TRANSFER_FEE_SATS, TEST_NOW_SECONDS);

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
        offer_valid_until_seconds: TEST_NOW_SECONDS + TEST_OFFER_VALID_FOR_SECONDS,
        option_duration_seconds: TEST_DURATION_SECS,
        status: OfferStatus::Open,
        created_at_seconds: TEST_NOW_SECONDS,
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
        offer_valid_until_seconds: TEST_NOW_SECONDS + TEST_OFFER_VALID_FOR_SECONDS,
        option_duration_seconds: TEST_DURATION_SECS,
        status,
        created_at_seconds: TEST_NOW_SECONDS,
    }
}

async fn execute_accept_wal_once(
    operation_id: crate::journaling::OperationId,
) -> crate::journaling::WalExecutionOutcome {
    crate::journaling::execute_wal_entry_now(operation_id).await
}

/// Given: an offer is in a state that is not allowed for acceptance
/// When: validating the acceptance request
/// Then: the request is rejected with the generic invalid-offer-state error
#[test]
fn test_validate_accept_offer_request_rejects_disallowed_statuses() {
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
        let error =
            validate_accept_offer_request(buyer, &accept_offer_item, &offer, TEST_NOW_SECONDS)
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
fn test_validate_accept_offer_request_allows_partially_filled_status() {
    // given
    let writer = test_principal(77);
    let buyer = test_principal(88);
    let accept_offer_item = build_test_accept_offer_item();
    let offer = build_test_offer(writer, OfferStatus::PartiallyFilled);

    // when
    let result = validate_accept_offer_request(buyer, &accept_offer_item, &offer, TEST_NOW_SECONDS);

    // then
    assert!(result.is_ok());
}

/// Given: accept minimum is lower than create minimum
/// When: validating an accept request within the accept range
/// Then: the request is allowed even below the create-offer minimum
#[test]
fn test_validate_accept_offer_request_allows_quantity_below_create_minimum() {
    // given
    let writer = test_principal(79);
    let buyer = test_principal(89);
    let accept_quantity_sats = 10_000;
    let prior_feature_flags = Config::feature_flags();
    let prior_accept_offer_quantity_sats = Config::trading_limits().accept_offer_quantity_sats;
    Config::set_feature_flags(FeatureFlags {
        is_partial_filling_enabled: true,
        ..prior_feature_flags
    });
    Config::set_accept_offer_quantity_sats_range(
        accept_quantity_sats,
        prior_accept_offer_quantity_sats.max,
    );
    let accept_offer_item = AcceptOfferItem {
        offer_id: TEST_OFFER_ID,
        quantity: accept_quantity_sats,
    };
    let offer = build_test_offer(writer, OfferStatus::Open);

    // when
    let result = validate_accept_offer_request(buyer, &accept_offer_item, &offer, TEST_NOW_SECONDS);

    Config::set_accept_offer_quantity_sats_range(
        prior_accept_offer_quantity_sats.min,
        prior_accept_offer_quantity_sats.max,
    );
    Config::set_feature_flags(prior_feature_flags);

    // then
    assert!(result.is_ok(), "{result:?}");
}

/// Given: a valid accept request
/// When: scheduling the accept without running WAL yet
/// Then: the caller gets a pending receipt and local state is prepared synchronously
#[test]
fn test_accept_offers_returns_pending_receipt_before_wal_runs() {
    // given
    let writer = test_principal(9);
    let buyer = test_principal(10);
    setup_test_state(writer, buyer);

    // when
    let receipt = accept_offers_use_case(buyer, vec![build_test_accept_offer_item()], 1).unwrap();
    let status = get_accept_status(receipt.operation_id).unwrap();

    // then
    match status {
        AcceptOffersStatus::Pending {
            receipt: pending_receipt,
            phase,
            last_error,
        } => {
            assert_eq!(pending_receipt.operation_id, receipt.operation_id);
            assert_eq!(phase, AcceptPhase::BuyerDebited);
            assert_eq!(last_error, None);
        }
        other => panic!("expected pending accept status, got {:?}", other),
    }

    let processing_offer = get_offer(TEST_OFFER_ID).expect("offer should exist");
    assert_eq!(processing_offer.status, OfferStatus::Processing);
    assert_eq!(processing_offer.remaining_quantity, 0);
}

/// Given: an accepted offer WAL is ready to finalize and no entry price has been persisted
/// When: the WAL runs
/// Then: it fetches a fresh current oracle price instead of using the cache-first spot path
#[tokio::test(flavor = "current_thread")]
async fn test_accept_wal_fetches_fresh_entry_price_without_cache_first_price() {
    // given
    const CACHE_FIRST_PRICE_CENTS: u64 = TEST_PRICE_CENTS - 1;
    const FRESH_PRICE_CENTS: u64 = TEST_PRICE_CENTS + 123_456;

    let writer = test_principal(111);
    let buyer = test_principal(112);
    setup_test_state(writer, buyer);
    let (oracle, oracle_calls) =
        RecordingAcceptOracle::new(CACHE_FIRST_PRICE_CENTS, FRESH_PRICE_CENTS);
    set_oracle(Rc::new(oracle));
    ledger::set_ledger(Rc::new(SecondTransferFailsLedger {
        completed_transfer_count: Cell::new(0),
        transfer_memos: RefCell::new(Vec::new()),
    }));
    let receipt = accept_offers_use_case(buyer, vec![build_test_accept_offer_item()], 101)
        .expect("accept should enqueue");

    // when
    let wal_execution_outcome = execute_accept_wal_once(receipt.operation_id).await;
    let accept_status = get_accept_status(receipt.operation_id).expect("accept status should load");

    // then
    assert!(matches!(
        wal_execution_outcome,
        crate::journaling::WalExecutionOutcome::Succeeded
    ));
    assert_eq!(oracle_calls.cache_first_call_count.get(), 0);
    assert_eq!(oracle_calls.fresh_call_count.get(), 1);
    assert_eq!(oracle_calls.settlement_call_count.get(), 0);

    match accept_status {
        AcceptOffersStatus::Succeeded { result, .. } => {
            assert_eq!(result.active_options.len(), 1);
            assert_eq!(
                result.active_options[0].entry_price_cents,
                FRESH_PRICE_CENTS
            );
        }
        other => panic!("expected succeeded accept status, got {:?}", other),
    }
}

/// Given: fresh current XRC pricing fails and the oracle has a cache fallback price
/// When: the accept WAL runs without a stored entry price
/// Then: it records the cache fallback price returned by the fresh-current oracle path
#[tokio::test(flavor = "current_thread")]
async fn test_accept_wal_uses_cache_fallback_when_fresh_current_price_fails() {
    // given
    const CACHE_FALLBACK_PRICE_CENTS: u64 = TEST_PRICE_CENTS - 1;

    let writer = test_principal(115);
    let buyer = test_principal(116);
    setup_test_state(writer, buyer);
    let (oracle, oracle_calls) =
        RecordingAcceptOracle::new_with_fresh_failure(CACHE_FALLBACK_PRICE_CENTS);
    set_oracle(Rc::new(oracle));
    ledger::set_ledger(Rc::new(SecondTransferFailsLedger {
        completed_transfer_count: Cell::new(0),
        transfer_memos: RefCell::new(Vec::new()),
    }));
    let receipt = accept_offers_use_case(buyer, vec![build_test_accept_offer_item()], 103)
        .expect("accept should enqueue");

    // when
    let wal_execution_outcome = execute_accept_wal_once(receipt.operation_id).await;
    let accept_status = get_accept_status(receipt.operation_id).expect("accept status should load");

    // then
    assert!(matches!(
        wal_execution_outcome,
        crate::journaling::WalExecutionOutcome::Succeeded
    ));
    assert_eq!(oracle_calls.fresh_call_count.get(), 1);
    assert_eq!(oracle_calls.cache_first_call_count.get(), 1);
    assert_eq!(oracle_calls.settlement_call_count.get(), 0);

    match accept_status {
        AcceptOffersStatus::Succeeded { result, .. } => {
            assert_eq!(result.active_options.len(), 1);
            assert_eq!(
                result.active_options[0].entry_price_cents,
                CACHE_FALLBACK_PRICE_CENTS
            );
        }
        other => panic!("expected succeeded accept status, got {:?}", other),
    }
}

/// Given: an accepted offer WAL already has an entry price from an earlier attempt
/// When: the WAL runs again
/// Then: it reuses the stored entry price without fetching any oracle price
#[tokio::test(flavor = "current_thread")]
async fn test_accept_wal_reuses_stored_entry_price_without_oracle_fetch() {
    // given
    const CACHE_FIRST_PRICE_CENTS: u64 = TEST_PRICE_CENTS - 1;
    const FRESH_PRICE_CENTS: u64 = TEST_PRICE_CENTS + 123_456;
    const STORED_ENTRY_PRICE_CENTS: u64 = TEST_PRICE_CENTS + 654_321;

    let writer = test_principal(113);
    let buyer = test_principal(114);
    setup_test_state(writer, buyer);
    let (oracle, oracle_calls) =
        RecordingAcceptOracle::new(CACHE_FIRST_PRICE_CENTS, FRESH_PRICE_CENTS);
    set_oracle(Rc::new(oracle));
    ledger::set_ledger(Rc::new(SecondTransferFailsLedger {
        completed_transfer_count: Cell::new(0),
        transfer_memos: RefCell::new(Vec::new()),
    }));
    let receipt = accept_offers_use_case(buyer, vec![build_test_accept_offer_item()], 102)
        .expect("accept should enqueue");
    update_accept_execution_snapshot(
        receipt.accept_journal_entry_id,
        STORED_ENTRY_PRICE_CENTS,
        true,
    );

    // when
    let wal_execution_outcome = execute_accept_wal_once(receipt.operation_id).await;
    let accept_status = get_accept_status(receipt.operation_id).expect("accept status should load");

    // then
    assert!(matches!(
        wal_execution_outcome,
        crate::journaling::WalExecutionOutcome::Succeeded
    ));
    assert_eq!(oracle_calls.cache_first_call_count.get(), 0);
    assert_eq!(oracle_calls.fresh_call_count.get(), 0);
    assert_eq!(oracle_calls.settlement_call_count.get(), 0);

    match accept_status {
        AcceptOffersStatus::Succeeded { result, .. } => {
            assert_eq!(result.active_options.len(), 1);
            assert_eq!(
                result.active_options[0].entry_price_cents,
                STORED_ENTRY_PRICE_CENTS
            );
        }
        other => panic!("expected succeeded accept status, got {:?}", other),
    }
}

/// Given: transfer fee cache is stale for a sync accept request
/// When: accept_offers_use_case is called
/// Then: it rejects with CONFIG_ERROR and leaves the offer open and buyer balance unchanged
#[test]
fn test_accept_offers_rejects_when_transfer_fee_cache_is_stale() {
    // given
    let writer = test_principal(70);
    let buyer = test_principal(71);
    setup_test_state(writer, buyer);
    ledger::set_cached_transfer_fee_for_testing(
        TESTING_CKBTC_TRANSFER_FEE_SATS,
        STALE_TRANSFER_FEE_FETCHED_AT_SECONDS,
    );

    // when
    let result = accept_offers_use_case(buyer, vec![build_test_accept_offer_item()], 6);

    // then
    let error = result.expect_err("accept should reject stale fee cache");
    assert_eq!(error.code, error_codes::CONFIG_ERROR.code);
    let offer_after = get_offer(TEST_OFFER_ID).expect("offer should exist");
    assert_eq!(offer_after.status, OfferStatus::Open);
    assert_eq!(offer_after.remaining_quantity, TEST_QUANTITY_SATS);
    let buyer_balance = get_balance(&buyer);
    assert_eq!(buyer_balance.available, TEST_BUYER_AVAILABLE_SATS);
}

/// Given: the same buyer submits the same accept request twice
/// When: the second request reuses the same nonce and items
/// Then: it returns the original receipt instead of enqueueing another accept
#[test]
fn test_accept_offers_is_idempotent_for_repeated_same_request() {
    // given
    let writer = test_principal(12);
    let buyer = test_principal(13);
    setup_test_state(writer, buyer);

    // when
    let first_receipt =
        accept_offers_use_case(buyer, vec![build_test_accept_offer_item()], 7).unwrap();
    let second_receipt =
        accept_offers_use_case(buyer, vec![build_test_accept_offer_item()], 7).unwrap();

    // then
    assert_eq!(first_receipt, second_receipt);
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
    let receipt = accept_offers_use_case(buyer, vec![build_test_accept_offer_item()], 2).unwrap();
    let local_task_set = task::LocalSet::new();

    // when
    let accept_status = local_task_set
        .run_until(async move {
            let accept_wal_task =
                task::spawn_local(
                    async move { execute_accept_wal_once(receipt.operation_id).await },
                );

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

            let wal_execution_outcome = accept_wal_task
                .await
                .expect("accept WAL task should complete");
            assert!(matches!(
                wal_execution_outcome,
                crate::journaling::WalExecutionOutcome::Succeeded
            ));

            get_accept_status(receipt.operation_id)
                .expect("accept status should load after WAL success")
        })
        .await;

    // then
    match accept_status {
        AcceptOffersStatus::Succeeded { result, .. } => {
            assert_eq!(result.active_options.len(), 1);
        }
        other => panic!("expected succeeded accept status, got {:?}", other),
    }

    let final_offer = get_offer(TEST_OFFER_ID).expect("offer should still exist");
    assert_eq!(final_offer.status, OfferStatus::Filled);
    assert_eq!(final_offer.remaining_quantity, 0);
}

/// Given: an accept pauses after marking an offer as Processing
/// When: the ledger transfer fails with a retryable error
/// Then: the accept remains pending for WAL retry and local preparation stays in place
#[tokio::test(flavor = "current_thread")]
async fn test_retryable_accept_failure_remains_pending_for_retry() {
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
    let receipt = accept_offers_use_case(buyer, vec![build_test_accept_offer_item()], 3).unwrap();
    let local_task_set = task::LocalSet::new();

    // when
    let accept_status = local_task_set
        .run_until(async move {
            let accept_wal_task =
                task::spawn_local(
                    async move { execute_accept_wal_once(receipt.operation_id).await },
                );

            first_transfer_started_receiver
                .await
                .expect("accept should reach the first transfer");

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

            let wal_execution_outcome = accept_wal_task
                .await
                .expect("accept WAL task should complete");
            assert!(matches!(
                wal_execution_outcome,
                crate::journaling::WalExecutionOutcome::RecoveryRequired(_)
            ));

            get_accept_status(receipt.operation_id)
                .expect("accept status should load after retryable WAL failure")
        })
        .await;

    // then
    match accept_status {
        AcceptOffersStatus::RecoveryRequired {
            phase, last_error, ..
        } => {
            assert_eq!(phase, AcceptPhase::BuyerDebited);
            assert!(last_error
                .as_ref()
                .is_some_and(|message| message.contains("transfer failed")));
        }
        other => panic!("expected recovery-required accept status, got {:?}", other),
    }

    let final_offer = get_offer(TEST_OFFER_ID).expect("offer should still exist");
    assert_eq!(final_offer.status, OfferStatus::Processing);
    assert_eq!(final_offer.remaining_quantity, 0);

    let writer_balance = get_balance(&writer);
    assert_eq!(writer_balance.available, 0);
    assert_eq!(writer_balance.locked_as_writer, TEST_QUANTITY_SATS);

    let buyer_balance = get_balance(&buyer);
    assert!(buyer_balance.available < TEST_BUYER_AVAILABLE_SATS);
}

/// Given: local finalization inputs become permanently invalid before WAL execution
/// When: the accept WAL runs
/// Then: the buyer balance and writer collateral are restored and the accept becomes failed
#[tokio::test(flavor = "current_thread")]
async fn test_permanent_accept_failure_restores_balance_and_collateral() {
    // given
    let writer = test_principal(55);
    let buyer = test_principal(66);
    setup_test_state(writer, buyer);
    let receipt = accept_offers_use_case(buyer, vec![build_test_accept_offer_item()], 4).unwrap();

    clear_offers();

    // when
    let wal_execution_outcome = execute_accept_wal_once(receipt.operation_id).await;
    let accept_status = get_accept_status(receipt.operation_id).expect("accept status should load");

    // then
    assert!(matches!(
        wal_execution_outcome,
        crate::journaling::WalExecutionOutcome::FailedPermanent(_)
    ));
    match accept_status {
        AcceptOffersStatus::Failed { message, .. } => {
            assert!(message.contains("offer 1 not found during accept finalization"));
        }
        other => panic!("expected failed accept status, got {:?}", other),
    }

    let restored_offer = get_offer(TEST_OFFER_ID);
    assert!(restored_offer.is_none());

    let writer_balance = get_balance(&writer);
    assert_eq!(writer_balance.available, TEST_QUANTITY_SATS);
    assert_eq!(writer_balance.locked_as_writer, 0);

    let buyer_balance = get_balance(&buyer);
    assert_eq!(buyer_balance.available, TEST_BUYER_AVAILABLE_SATS);
}

/// Given: the writer premium transfer succeeds but the platform fee transfer fails
/// When: the accept WAL executes
/// Then: the option is still created and only the failed fee portion is waived
#[tokio::test(flavor = "current_thread")]
async fn test_accept_offer_succeeds_when_platform_fee_transfer_fails() {
    // given
    let writer = test_principal(99);
    let buyer = test_principal(100);
    setup_test_state(writer, buyer);
    let ledger = Rc::new(SecondTransferFailsLedger {
        completed_transfer_count: Cell::new(0),
        transfer_memos: RefCell::new(Vec::new()),
    });
    ledger::set_ledger(ledger.clone());

    let premium_sats = calculate_premium_in_sats(TEST_QUANTITY_SATS, TEST_PREMIUM_BPS);
    let premium_fee_sats =
        calculate_premium_fee(premium_sats).expect("premium fee should calculate");
    let premium_to_writer_sats = premium_sats.saturating_sub(premium_fee_sats);
    let expected_buyer_available_sats = TEST_BUYER_AVAILABLE_SATS
        .saturating_sub(premium_to_writer_sats)
        .saturating_sub(TESTING_CKBTC_TRANSFER_FEE_SATS);
    let receipt = accept_offers_use_case(buyer, vec![build_test_accept_offer_item()], 5).unwrap();

    // when
    let wal_execution_outcome = execute_accept_wal_once(receipt.operation_id).await;
    let accept_status = get_accept_status(receipt.operation_id).expect("accept status should load");

    // then
    assert!(matches!(
        wal_execution_outcome,
        crate::journaling::WalExecutionOutcome::Succeeded
    ));
    match accept_status {
        AcceptOffersStatus::Succeeded { result, .. } => {
            assert_eq!(result.active_options.len(), 1);
            assert_eq!(
                result.active_options[0].premium_paid,
                premium_to_writer_sats
            );
        }
        other => panic!("expected succeeded accept status, got {:?}", other),
    }

    let final_offer = get_offer(TEST_OFFER_ID).expect("offer should still exist");
    assert_eq!(final_offer.status, OfferStatus::Filled);
    assert_eq!(final_offer.remaining_quantity, 0);

    let writer_balance = get_balance(&writer);
    assert_eq!(writer_balance.available, premium_to_writer_sats);
    assert_eq!(writer_balance.locked_as_writer, TEST_QUANTITY_SATS);

    let buyer_balance = get_balance(&buyer);
    assert_eq!(buyer_balance.available, expected_buyer_available_sats);

    assert_eq!(get_platform_fees_collected(), 0);
    let transfer_memos = ledger.transfer_memos.borrow();
    let writer_part = principal_memo_part(writer);
    let writer_transfer_index_part = u64_memo_part(0);
    let expected_writer_transfer_memo = ledger_memo(
        receipt.operation_id,
        LedgerMemoKind::AcceptWriterTransfer,
        &[&writer_transfer_index_part, &writer_part],
    );
    let expected_platform_fee_memo =
        ledger_memo(receipt.operation_id, LedgerMemoKind::AcceptPlatformFee, &[]);

    assert_eq!(transfer_memos.len(), 2);
    assert_eq!(transfer_memos[0], Some(expected_writer_transfer_memo));
    assert_eq!(transfer_memos[1], Some(expected_platform_fee_memo));
    assert_ne!(transfer_memos[0], transfer_memos[1]);
}

/// Given: accept finalization already created an active option before a retry
/// When: the accept WAL finalization is replayed from TransfersComplete
/// Then: writer premium and platform fee accounting are not applied again
#[tokio::test(flavor = "current_thread")]
async fn test_accept_finalization_replay_does_not_double_credit_writer_or_platform_fee() {
    // given
    let writer = test_principal(101);
    let buyer = test_principal(102);
    setup_test_state(writer, buyer);
    let receipt = accept_offers_use_case(buyer, vec![build_test_accept_offer_item()], 6).unwrap();
    let wal_entry = get_entry(receipt.operation_id).expect("accept wal entry should exist");
    let WalPayload::Accept(accept_payload) = wal_entry.payload else {
        panic!("accept WAL entry should contain accept payload");
    };
    let prepared_accept = accept_payload
        .prepared_accepts
        .first()
        .expect("prepared accept should exist");
    let strike_price_cents =
        calculate_strike_price_in_cents(TEST_PRICE_CENTS, prepared_accept.strike_basis_points);

    update_accept_execution_snapshot(receipt.accept_journal_entry_id, TEST_PRICE_CENTS, true);
    update_accept_phase(
        receipt.accept_journal_entry_id,
        AcceptPhase::TransfersComplete,
    );
    add_available(writer, prepared_accept.premium_to_writer_sats);
    add_platform_fee(prepared_accept.premium_fee_sats);
    insert_active_option(ActiveOption {
        id: prepared_accept.option_id,
        offer_id: prepared_accept.offer_id,
        buyer,
        writer,
        asset: prepared_accept.asset,
        option_type: prepared_accept.option_type,
        quantity: prepared_accept.quantity_sats,
        entry_price_cents: TEST_PRICE_CENTS,
        strike_price_cents,
        premium_paid: prepared_accept.premium_sats,
        accepted_at_seconds: TEST_NOW_SECONDS,
        expiry_seconds: prepared_accept.expiry_seconds,
        status: ActiveOptionStatus::Active,
        fill_group_id: Some(receipt.fill_group_id),
        profit_fee_basis_points: prepared_accept.profit_fee_basis_points,
    });
    let mut offer = get_offer(TEST_OFFER_ID).expect("offer should exist");
    offer.status = OfferStatus::Filled;
    update_offer(offer);

    let writer_balance_before_replay = get_balance(&writer);
    let platform_fees_before_replay = get_platform_fees_collected();

    // when
    let replay_result = run_accept_wal(receipt.operation_id, &accept_payload).await;

    // then
    assert_eq!(
        replay_result,
        Ok(AcceptWalResult {
            option_ids: vec![prepared_accept.option_id],
            fill_group_id: receipt.fill_group_id,
        })
    );
    let writer_balance_after_replay = get_balance(&writer);
    assert_eq!(
        writer_balance_after_replay.available,
        writer_balance_before_replay.available
    );
    assert_eq!(
        writer_balance_after_replay.locked_as_writer,
        writer_balance_before_replay.locked_as_writer
    );
    assert_eq!(get_platform_fees_collected(), platform_fees_before_replay);
    assert!(get_active_option(prepared_accept.option_id).is_some());
}

/// Given: one buyer has already started accepting and the offer is Processing
/// When: a second buyer tries to accept the same offer before the first WAL run finishes
/// Then: the second request is rejected with invalid offer state
#[tokio::test(flavor = "current_thread")]
async fn test_second_buyer_cannot_accept_offer_while_first_is_processing() {
    // given
    let writer = test_principal(21);
    let first_buyer = test_principal(22);
    let second_buyer = test_principal(23);
    setup_test_state(writer, first_buyer);
    set_balance(
        second_buyer,
        UserBalance {
            available: TEST_BUYER_AVAILABLE_SATS,
            locked_as_writer: 0,
        },
    );

    let (first_transfer_started_sender, first_transfer_started_receiver) = oneshot::channel();
    let (first_transfer_result_sender, first_transfer_result_receiver) = oneshot::channel();
    ledger::set_ledger(Rc::new(CoordinatedLedger {
        first_transfer_started_sender: RefCell::new(Some(first_transfer_started_sender)),
        first_transfer_result_receiver: RefCell::new(Some(first_transfer_result_receiver)),
        completed_transfer_count: Cell::new(0),
    }));
    let first_receipt =
        accept_offers_use_case(first_buyer, vec![build_test_accept_offer_item()], 80).unwrap();
    let local_task_set = task::LocalSet::new();

    // when
    let second_buyer_error_code = local_task_set
        .run_until(async move {
            let accept_wal_task = task::spawn_local(async move {
                execute_accept_wal_once(first_receipt.operation_id).await
            });

            first_transfer_started_receiver
                .await
                .expect("first accept should reach the first transfer");

            let second_buyer_error =
                accept_offers_use_case(second_buyer, vec![build_test_accept_offer_item()], 81)
                    .expect_err("second buyer must be rejected while offer is processing");

            first_transfer_result_sender
                .send(Ok(TEST_BLOCK_INDEX))
                .expect("first transfer should still be waiting");
            let first_outcome = accept_wal_task
                .await
                .expect("first accept WAL should finish");
            assert!(matches!(
                first_outcome,
                crate::journaling::WalExecutionOutcome::Succeeded
            ));

            second_buyer_error.code
        })
        .await;

    // then
    assert_eq!(
        second_buyer_error_code,
        error_codes::INVALID_OFFER_STATE.code
    );
}

/// Given: buyer funds are reserved by accept local preparation
/// When: the same buyer tries to withdraw those funds before accept WAL completes
/// Then: withdrawal is rejected for insufficient available balance
#[test]
fn test_withdraw_fails_when_accept_has_already_reserved_buyer_balance() {
    // given
    let writer = test_principal(31);
    let buyer = test_principal(32);
    setup_test_state(writer, buyer);

    let _accept_receipt = accept_offers_use_case(buyer, vec![build_test_accept_offer_item()], 90)
        .expect("accept should enqueue and reserve buyer funds");
    let withdrawal_params = WithdrawParams {
        btc_address: "tb1qacceptfirst".to_string(),
        amount: TEST_BUYER_AVAILABLE_SATS,
    };

    // when
    let withdraw_result = withdraw_ckbtc_use_case(buyer, withdrawal_params, 91);

    // then
    let withdraw_error = withdraw_result.expect_err("withdraw should fail when funds are reserved");
    assert_eq!(withdraw_error.code, error_codes::INSUFFICIENT_BALANCE.code);
}

/// Given: buyer funds are debited by withdrawal local preparation
/// When: the same buyer tries to accept an offer using the same funds
/// Then: accept is rejected for insufficient balance and offer state remains open
#[test]
fn test_accept_fails_when_withdraw_has_already_debited_buyer_balance() {
    // given
    let writer = test_principal(41);
    let buyer = test_principal(42);
    setup_test_state(writer, buyer);
    let withdrawal_params = WithdrawParams {
        btc_address: "tb1qwithdrawfirst".to_string(),
        amount: TEST_BUYER_AVAILABLE_SATS,
    };
    let _withdraw_receipt = withdraw_ckbtc_use_case(buyer, withdrawal_params, 92)
        .expect("withdraw should enqueue and debit buyer");

    // when
    let accept_result = accept_offers_use_case(buyer, vec![build_test_accept_offer_item()], 93);

    // then
    let accept_error =
        accept_result.expect_err("accept should fail when buyer funds were already debited");
    assert_eq!(accept_error.code, error_codes::INSUFFICIENT_BALANCE.code);

    let offer = get_offer(TEST_OFFER_ID).expect("offer should remain available");
    assert_eq!(offer.status, OfferStatus::Open);
    assert_eq!(offer.remaining_quantity, TEST_QUANTITY_SATS);
}

/// Given: writer collateral is reserved by accept local preparation
/// When: the writer attempts to withdraw the same sats immediately
/// Then: withdrawal is rejected and collateral remains locked
#[test]
fn test_writer_withdraw_fails_when_collateral_is_locked_by_accept() {
    // given
    let writer = test_principal(51);
    let buyer = test_principal(52);
    setup_test_state(writer, buyer);

    let _accept_receipt = accept_offers_use_case(buyer, vec![build_test_accept_offer_item()], 94)
        .expect("accept should enqueue and lock writer collateral");
    let withdrawal_params = WithdrawParams {
        btc_address: "tb1qwriterlocked".to_string(),
        amount: TEST_QUANTITY_SATS,
    };

    // when
    let withdraw_result = withdraw_ckbtc_use_case(writer, withdrawal_params, 95);

    // then
    let withdraw_error =
        withdraw_result.expect_err("writer withdraw should fail while collateral is locked");
    assert_eq!(withdraw_error.code, error_codes::INSUFFICIENT_BALANCE.code);

    let writer_balance = get_balance(&writer);
    assert_eq!(writer_balance.available, 0);
    assert_eq!(writer_balance.locked_as_writer, TEST_QUANTITY_SATS);
}
