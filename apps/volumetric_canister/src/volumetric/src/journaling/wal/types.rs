use candid::{CandidType, Principal};
use serde::{Deserialize, Serialize};

use crate::journaling::OperationId;
use crate::storage::{Asset, OfferStatus, OptionType};
use crate::usecases::{AcceptWalResult, SettlementWalResult, WithdrawalWalResult};

#[derive(CandidType, Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq)]
pub enum WalKind {
    Settlement,
    Withdrawal,
    Accept,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq)]
/// Persisted execution state for a WAL operation.
pub enum WalStatus {
    /// Ready to run.
    Enqueued,
    /// Currently running.
    InFlight,
    /// Failed with a transient external outcome and is eligible for automatic retry.
    RetryRequired,
    /// Finished successfully.
    Succeeded,
    /// Failed with ambiguous external outcome and requires operator recovery.
    RecoveryRequired,
    /// Failed permanently.
    FailedPermanent,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
pub struct WalPolicy {
    pub max_retries: u32,
    pub backoff_secs: u64,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
pub struct SettlementWalPayload {
    pub option_id: u64,
    pub settlement_price_cents: u64,
    pub created_at_time_ns: u64,
    pub transfer_fee_sats: u64,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
pub struct WithdrawalWalPayload {
    pub withdrawal_id: u64,
    pub principal: Principal,
    /// Gross ckBTC withdraw amount (debited from platform `available`); refunded if the WAL fails.
    #[serde(rename = "amount_sats")]
    pub gross_withdraw_amount_sats: u64,
    /// Sats for ICRC-2 approve and ckBTC minter retrieve (gross minus ledger fee reserve).
    pub withdraw_amount_after_fees_sats: u64,
    pub btc_address: String,
    pub created_at_time_ns: u64,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
pub struct AcceptWalPreparedAccept {
    pub offer_id: u64,
    pub writer: Principal,
    pub asset: Asset,
    pub option_type: OptionType,
    pub strike_basis_points: u16,
    pub quantity_sats: u64,
    pub premium_sats: u64,
    pub premium_to_writer_sats: u64,
    pub premium_fee_sats: u64,
    pub option_id: u64,
    pub expiry_seconds: u64,
    pub original_remaining_quantity_sats: u64,
    pub original_status: OfferStatus,
    pub profit_fee_basis_points: u64,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
pub struct AcceptWalTransfer {
    pub writer: Principal,
    pub amount_sats: u64,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
pub struct AcceptWalPayload {
    pub accept_journal_entry_id: u64,
    pub buyer: Principal,
    pub fill_group_id: u64,
    pub total_buyer_debit_required_sats: u64,
    pub planned_platform_fee_sats: u64,
    pub transfer_fee_sats: u64,
    pub created_at_time_ns: u64,
    pub prepared_accepts: Vec<AcceptWalPreparedAccept>,
    pub writer_transfers: Vec<AcceptWalTransfer>,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
pub enum WalPayload {
    Settlement(SettlementWalPayload),
    Withdrawal(WithdrawalWalPayload),
    Accept(AcceptWalPayload),
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
pub enum WalResult {
    Settlement(SettlementWalResult),
    Withdrawal(WithdrawalWalResult),
    Accept(AcceptWalResult),
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
pub struct WalEntry {
    pub id: OperationId,
    pub kind: WalKind,
    pub attempts: u32,
    pub status: WalStatus,
    pub first_seen_seconds: u64,
    pub last_update_seconds: u64,
    pub last_err: Option<String>,
    pub payload: WalPayload,
    pub max_retries: u32,
    pub backoff_secs: u64,
    pub next_attempt_at_seconds: u64,
    pub result: Option<WalResult>,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
pub enum WalExecutionError {
    Retryable(String),
    Permanent(String),
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
pub enum WalExecutionOutcome {
    Succeeded,
    SucceededAlready,
    SkippedAlreadyInFlight,
    RetryRequired(String),
    RecoveryRequired(String),
    FailedPermanent(String),
}
