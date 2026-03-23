use std::cell::{Cell, RefCell};
use std::rc::Rc;

use async_trait::async_trait;
use candid::{Nat, Principal};
use icrc_ledger_types::icrc1::account::Account;
use icrc_ledger_types::icrc2::approve::ApproveArgs;
use tokio::sync::oneshot;
use tokio::task;

use super::accept_offers::validate_accept_offer_request;
use super::*;
use crate::errors::{error_codes, VolumetricError};
use crate::ic::{self, IcRuntime};
use crate::ledger::{self, LedgerClient};
use crate::oracle::{set_oracle, StubOracle};
use crate::storage::{
    calculate_premium_fee, calculate_premium_in_sats, clear_active_options, clear_events,
    clear_offers, get_balance, get_offer, get_platform_fees_collected, insert_offer, set_balance,
    AcceptPhase, Asset, Offer, OfferStatus, OptionType, UserBalance, CKBTC_TRANSFER_FEE,
};
use crate::usecases::{withdraw_ckbtc_use_case, WithdrawParams};

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
        let error = validate_accept_offer_request(buyer, &accept_offer_item, &offer, TEST_NOW_NS)
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
    let result = validate_accept_offer_request(buyer, &accept_offer_item, &offer, TEST_NOW_NS);

    // then
    assert!(result.is_ok());
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
    let status = get_accept_status_use_case(receipt.operation_id).unwrap();

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

            get_accept_status_use_case(receipt.operation_id)
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
                crate::journaling::WalExecutionOutcome::FailedRetryable(_)
            ));

            get_accept_status_use_case(receipt.operation_id)
                .expect("accept status should load after retryable WAL failure")
        })
        .await;

    // then
    match accept_status {
        AcceptOffersStatus::Pending {
            phase, last_error, ..
        } => {
            assert_eq!(phase, AcceptPhase::BuyerDebited);
            assert!(last_error
                .as_ref()
                .is_some_and(|message| message.contains("transfer failed")));
        }
        other => panic!("expected pending accept status, got {:?}", other),
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
    let accept_status =
        get_accept_status_use_case(receipt.operation_id).expect("accept status should load");

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
    ledger::set_ledger(Rc::new(SecondTransferFailsLedger {
        completed_transfer_count: Cell::new(0),
    }));

    let premium_sats = calculate_premium_in_sats(TEST_QUANTITY_SATS, TEST_PREMIUM_BPS);
    let premium_fee_sats = calculate_premium_fee(premium_sats);
    let premium_to_writer_sats = premium_sats.saturating_sub(premium_fee_sats);
    let expected_buyer_available_sats = TEST_BUYER_AVAILABLE_SATS
        .saturating_sub(premium_to_writer_sats)
        .saturating_sub(CKBTC_TRANSFER_FEE);
    let receipt = accept_offers_use_case(buyer, vec![build_test_accept_offer_item()], 5).unwrap();

    // when
    let wal_execution_outcome = execute_accept_wal_once(receipt.operation_id).await;
    let accept_status =
        get_accept_status_use_case(receipt.operation_id).expect("accept status should load");

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
