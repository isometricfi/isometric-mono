// This is an experimental feature to generate Rust binding from Candid.
// You may want to manually adjust some of the types.
#![allow(dead_code, unused_imports)]
use candid::{self, CandidType, Deserialize, Principal};
use ic_cdk::api::call::CallResult as Result;

#[derive(CandidType, Deserialize)]
pub enum Mode {
    /// Only specified principals can modify minter's state.
    RestrictedTo(Vec<Principal>),
    /// Only specified principals can convert BTC to ckBTC.
    DepositsRestrictedTo(Vec<Principal>),
    /// The minter does not allow any state modifications.
    ReadOnly,
    /// Anyone can interact with the minter.
    GeneralAvailability,
}
/// The upgrade parameters of the minter canister.
#[derive(CandidType, Deserialize)]
pub struct UpgradeArgs {
    /// / The expiration duration (in seconds) for cached entries in the get_utxos cache.
    pub get_utxos_cache_expiration_seconds: Option<u64>,
    /// / The canister id of the KYT canister (deprecated, use btc_checker_principal instead).
    pub kyt_principal: Option<Principal>,
    /// / If set, overrides the current minter's operation mode.
    pub mode: Option<Mode>,
    /// The minimal amount of ckBTC that the minter converts to BTC.
    pub retrieve_btc_min_amount: Option<u64>,
    /// The minimal amount of BTC that can be converted to ckBTC.
    /// UTXOs with lower values will be ignored.
    pub deposit_btc_min_amount: Option<u64>,
    /// / Maximum time in nanoseconds that a transaction should spend in the queue
    /// / before being sent.
    pub max_time_in_queue_nanos: Option<u64>,
    /// / The fee per Bitcoin check.
    pub check_fee: Option<u64>,
    /// / The maximum number of input UTXOs allowed in a transaction.
    pub max_num_inputs_in_transaction: Option<u64>,
    /// / The minimum number of available UTXOs to trigger a consolidation.
    pub utxo_consolidation_threshold: Option<u64>,
    /// / The principal of the Bitcoin checker canister.
    pub btc_checker_principal: Option<Principal>,
    /// / The minimum number of confirmations required for the minter to
    /// / accept a Bitcoin transaction.
    pub min_confirmations: Option<u32>,
    /// / The fee paid per check by the KYT canister (deprecated, use check_fee instead).
    pub kyt_fee: Option<u64>,
}
#[derive(CandidType, Deserialize)]
pub enum BtcNetwork {
    /// The public Bitcoin mainnet.
    Mainnet,
    /// A local Bitcoin regtest installation.
    Regtest,
    /// The public Bitcoin testnet.
    Testnet,
}
/// The initialization parameters of the minter canister.
#[derive(CandidType, Deserialize)]
pub struct InitArgs {
    /// / The expiration duration (in seconds) for cached entries in the get_utxos cache.
    pub get_utxos_cache_expiration_seconds: Option<u64>,
    /// / The canister id of the KYT canister (deprecated, use btc_checker_principal instead).
    pub kyt_principal: Option<Principal>,
    /// The name of the ECDSA key to use.
    /// E.g., "dfx_test_key" on the local replica.
    pub ecdsa_key_name: String,
    /// / The minter's operation mode.
    pub mode: Mode,
    /// The minimal amount of ckBTC that can be converted to BTC.
    pub retrieve_btc_min_amount: u64,
    /// The minimal amount of BTC that can be converted to ckBTC.
    /// UTXOs with lower values will be ignored.
    pub deposit_btc_min_amount: Option<u64>,
    /// The principal of the ledger that handles ckBTC transfers.
    /// The default account of the ckBTC minter must be configured as
    /// the minting account of the ledger.
    pub ledger_id: Principal,
    /// / Maximum time in nanoseconds that a transaction should spend in the queue
    /// / before being sent.
    pub max_time_in_queue_nanos: u64,
    /// The minter will interact with this Bitcoin network.
    pub btc_network: BtcNetwork,
    /// / The fee paid per Bitcoin check.
    pub check_fee: Option<u64>,
    /// / The maximum number of input UTXOs allowed in a transaction.
    pub max_num_inputs_in_transaction: Option<u64>,
    /// / The minimum number of available UTXOs to trigger a consolidation.
    pub utxo_consolidation_threshold: Option<u64>,
    /// / The canister id of the Bitcoin checker canister.
    pub btc_checker_principal: Option<Principal>,
    /// / The minimum number of confirmations required for the minter to
    /// / accept a Bitcoin transaction.
    pub min_confirmations: Option<u32>,
    /// / The fee paid per check by the KYT canister (deprecated, use check_fee instead).
    pub kyt_fee: Option<u64>,
}
#[derive(CandidType, Deserialize)]
pub enum MinterArg {
    Upgrade(Option<UpgradeArgs>),
    Init(InitArgs),
}
#[derive(CandidType, Deserialize)]
pub enum MemoType {
    Burn,
    Mint,
}
#[derive(CandidType, Deserialize)]
pub struct DecodeLedgerMemoArgs {
    /// The encoded memo type
    pub memo_type: MemoType,
    /// The encoded memo from a minter transaction on the ledger
    pub encoded_memo: serde_bytes::ByteBuf,
}
#[derive(CandidType, Deserialize)]
pub enum Status {
    CallFailed,
    /// The minter rejected a retrieve_btc due to a failed Bitcoin check.
    Rejected,
    /// The minter accepted a retrieve_btc request.
    Accepted,
}
#[derive(CandidType, Deserialize)]
pub enum BurnMemo {
    /// The minter consolidated UTXOs.
    Consolidate {
        /// The total value of the consolidated UTXOs.
        value: u64,
        /// The number of input UTXOs that were consolidated.
        inputs: u64,
    },
    /// The minter processed a retrieve_btc request.
    Convert {
        /// The status of the Bitcoin check.
        status: Option<Status>,
        /// The destination of the retrieve BTC request.
        address: Option<String>,
        /// The check fee for the burn.
        kyt_fee: Option<u64>,
    },
}
#[derive(CandidType, Deserialize)]
pub enum MintMemo {
    /// [deprecated] The minter minted accumulated check fees to the KYT provider.
    Kyt,
    ReimburseWithdrawal {
        /// The id corresponding to the withdrawal request,
        /// which corresponds to the ledger burn index.
        withdrawal_id: u64,
    },
    /// [deprecated] The minter failed to check retrieve btc destination address
    /// or the destination address is tainted.
    KytFail {
        /// The status of the Bitcoin check.
        status: Option<Status>,
        associated_burn_index: Option<u64>,
        /// The Bitcoin check fee.
        kyt_fee: Option<u64>,
    },
    /// The minter converted a single UTXO to ckBTC.
    Convert {
        /// The transaction ID of the accepted UTXO.
        txid: Option<serde_bytes::ByteBuf>,
        /// UTXO's output index within the BTC transaction.
        vout: Option<u32>,
        /// The Bitcoin check fee.
        kyt_fee: Option<u64>,
    },
}
#[derive(CandidType, Deserialize)]
pub enum DecodedMemo {
    /// The decoded BurnMemo - `opt` since other variants of `BurnMemo` could be added in the future.
    Burn(Option<BurnMemo>),
    /// The decoded MintMemo - `opt` since other variants of `MintMemo` could be added in the future.
    Mint(Option<MintMemo>),
}
#[derive(CandidType, Deserialize)]
pub enum DecodeLedgerMemoError {
    /// The provided memo could not be decoded.
    InvalidMemo(String),
}
pub type DecodeLedgerMemoResult =
    std::result::Result<Option<DecodedMemo>, Option<DecodeLedgerMemoError>>;
#[derive(CandidType, Deserialize)]
pub struct EstimateWithdrawalFeeArg {
    pub amount: Option<u64>,
}
#[derive(CandidType, Deserialize)]
pub struct EstimateWithdrawalFeeRet {
    pub minter_fee: u64,
    pub bitcoin_fee: u64,
}
#[derive(CandidType, Deserialize)]
pub struct GetBtcAddressArg {
    pub owner: Option<Principal>,
    pub subaccount: Option<serde_bytes::ByteBuf>,
}
#[derive(CandidType, Deserialize)]
pub struct MemoryMetrics {
    pub wasm_binary_size: candid::Nat,
    pub wasm_chunk_store_size: candid::Nat,
    pub canister_history_size: candid::Nat,
    pub stable_memory_size: candid::Nat,
    pub snapshots_size: candid::Nat,
    pub wasm_memory_size: candid::Nat,
    pub global_memory_size: candid::Nat,
    pub custom_sections_size: candid::Nat,
}
#[derive(CandidType, Deserialize)]
pub enum CanisterStatusType {
    #[serde(rename = "stopped")]
    Stopped,
    #[serde(rename = "stopping")]
    Stopping,
    #[serde(rename = "running")]
    Running,
}
#[derive(CandidType, Deserialize)]
pub struct EnvironmentVariable {
    pub value: String,
    pub name: String,
}
#[derive(CandidType, Deserialize)]
pub enum LogVisibility {
    #[serde(rename = "controllers")]
    Controllers,
    #[serde(rename = "public")]
    Public,
    #[serde(rename = "allowed_viewers")]
    AllowedViewers(Vec<Principal>),
}
#[derive(CandidType, Deserialize)]
pub struct DefiniteCanisterSettings {
    pub freezing_threshold: candid::Nat,
    pub wasm_memory_threshold: candid::Nat,
    pub environment_variables: Vec<EnvironmentVariable>,
    pub controllers: Vec<Principal>,
    pub reserved_cycles_limit: candid::Nat,
    pub log_visibility: LogVisibility,
    pub wasm_memory_limit: candid::Nat,
    pub memory_allocation: candid::Nat,
    pub compute_allocation: candid::Nat,
}
#[derive(CandidType, Deserialize)]
pub struct QueryStats {
    pub response_payload_bytes_total: candid::Nat,
    pub num_instructions_total: candid::Nat,
    pub num_calls_total: candid::Nat,
    pub request_payload_bytes_total: candid::Nat,
}
#[derive(CandidType, Deserialize)]
pub struct CanisterStatusResponse {
    pub memory_metrics: MemoryMetrics,
    pub status: CanisterStatusType,
    pub memory_size: candid::Nat,
    pub ready_for_migration: bool,
    pub version: u64,
    pub cycles: candid::Nat,
    pub settings: DefiniteCanisterSettings,
    pub query_stats: QueryStats,
    pub idle_cycles_burned_per_day: candid::Nat,
    pub module_hash: Option<serde_bytes::ByteBuf>,
    pub reserved_cycles: candid::Nat,
}
#[derive(CandidType, Deserialize)]
pub struct GetEventsArg {
    pub start: u64,
    pub length: u64,
}
/// Represents an account on the ckBTC ledger.
#[derive(CandidType, Deserialize)]
pub struct Account {
    pub owner: Principal,
    pub subaccount: Option<serde_bytes::ByteBuf>,
}
#[derive(CandidType, Deserialize)]
pub struct UtxoOutpoint {
    pub txid: serde_bytes::ByteBuf,
    pub vout: u32,
}
#[derive(CandidType, Deserialize)]
pub struct Utxo {
    pub height: u32,
    pub value: u64,
    pub outpoint: UtxoOutpoint,
}
#[derive(CandidType, Deserialize)]
pub enum ReimbursementReason {
    CallFailed,
    TaintedDestination {
        kyt_fee: u64,
        kyt_provider: Principal,
    },
}
#[derive(CandidType, Deserialize)]
pub struct EventTypeSentTransactionChangeOutputInner {
    pub value: u64,
    pub vout: u32,
}
#[derive(CandidType, Deserialize)]
pub struct WithdrawalFee {
    pub minter_fee: u64,
    pub bitcoin_fee: u64,
}
#[derive(CandidType, Deserialize)]
pub enum SuspendedReason {
    /// The minter ignored this UTXO because UTXO's value is too small to pay
    /// the check fees.
    ValueTooSmall,
    /// The Bitcoin checker considered this UTXO to be tainted.
    Quarantined,
}
#[derive(CandidType, Deserialize)]
pub enum BitcoinAddress {
    #[serde(rename = "p2wsh_v0")]
    P2wshV0(serde_bytes::ByteBuf),
    #[serde(rename = "p2tr_v1")]
    P2trV1(serde_bytes::ByteBuf),
    #[serde(rename = "p2sh")]
    P2sh(serde_bytes::ByteBuf),
    #[serde(rename = "p2wpkh_v0")]
    P2wpkhV0(serde_bytes::ByteBuf),
    #[serde(rename = "p2pkh")]
    P2pkh(serde_bytes::ByteBuf),
}
#[derive(CandidType, Deserialize)]
pub enum InvalidTransactionError {
    #[serde(rename = "too_many_inputs")]
    TooManyInputs {
        max_num_inputs: u64,
        num_inputs: u64,
    },
}
#[derive(CandidType, Deserialize)]
pub enum WithdrawalReimbursementReason {
    #[serde(rename = "invalid_transaction")]
    InvalidTransaction(InvalidTransactionError),
}
#[derive(CandidType, Deserialize)]
pub struct EventTypeReplacedTransactionChangeOutput {
    pub value: u64,
    pub vout: u32,
}
#[derive(CandidType, Deserialize)]
pub enum ReplacedReason {
    #[serde(rename = "to_cancel")]
    ToCancel {
        reason: WithdrawalReimbursementReason,
    },
    #[serde(rename = "to_retry")]
    ToRetry,
}
#[derive(CandidType, Deserialize)]
pub enum EventType {
    #[serde(rename = "received_utxos")]
    ReceivedUtxos {
        to_account: Account,
        mint_txid: Option<u64>,
        utxos: Vec<Utxo>,
    },
    #[serde(rename = "schedule_deposit_reimbursement")]
    ScheduleDepositReimbursement {
        burn_block_index: u64,
        account: Account,
        amount: u64,
        reason: ReimbursementReason,
    },
    #[serde(rename = "sent_transaction")]
    SentTransaction {
        fee: Option<u64>,
        change_output: Option<EventTypeSentTransactionChangeOutputInner>,
        txid: serde_bytes::ByteBuf,
        signed_tx: Option<serde_bytes::ByteBuf>,
        withdrawal_fee: Option<WithdrawalFee>,
        utxos: Vec<Utxo>,
        requests: Vec<u64>,
        submitted_at: u64,
    },
    #[serde(rename = "distributed_kyt_fee")]
    DistributedKytFee {
        block_index: u64,
        amount: u64,
        kyt_provider: Principal,
    },
    #[serde(rename = "init")]
    Init(InitArgs),
    #[serde(rename = "upgrade")]
    Upgrade(UpgradeArgs),
    #[serde(rename = "retrieve_btc_kyt_failed")]
    RetrieveBtcKytFailed {
        block_index: u64,
        owner: Principal,
        uuid: String,
        address: String,
        amount: u64,
        kyt_provider: Principal,
    },
    #[serde(rename = "suspended_utxo")]
    SuspendedUtxo {
        utxo: Utxo,
        account: Account,
        reason: SuspendedReason,
    },
    #[serde(rename = "accepted_retrieve_btc_request")]
    AcceptedRetrieveBtcRequest {
        received_at: u64,
        block_index: u64,
        address: BitcoinAddress,
        reimbursement_account: Option<Account>,
        amount: u64,
        kyt_provider: Option<Principal>,
    },
    #[serde(rename = "checked_utxo")]
    CheckedUtxo {
        clean: bool,
        utxo: Utxo,
        uuid: String,
        kyt_provider: Option<Principal>,
    },
    #[serde(rename = "schedule_withdrawal_reimbursement")]
    ScheduleWithdrawalReimbursement {
        burn_block_index: u64,
        account: Account,
        amount: u64,
        reason: WithdrawalReimbursementReason,
    },
    #[serde(rename = "quarantined_withdrawal_reimbursement")]
    QuarantinedWithdrawalReimbursement { burn_block_index: u64 },
    #[serde(rename = "removed_retrieve_btc_request")]
    RemovedRetrieveBtcRequest { block_index: u64 },
    #[serde(rename = "confirmed_transaction")]
    ConfirmedTransaction { txid: serde_bytes::ByteBuf },
    #[serde(rename = "replaced_transaction")]
    ReplacedTransaction {
        fee: u64,
        change_output: EventTypeReplacedTransactionChangeOutput,
        new_utxos: Option<Vec<Utxo>>,
        old_txid: serde_bytes::ByteBuf,
        withdrawal_fee: Option<WithdrawalFee>,
        new_txid: serde_bytes::ByteBuf,
        submitted_at: u64,
        reason: Option<ReplacedReason>,
    },
    #[serde(rename = "checked_utxo_v2")]
    CheckedUtxoV2 { utxo: Utxo, account: Account },
    #[serde(rename = "ignored_utxo")]
    IgnoredUtxo { utxo: Utxo },
    #[serde(rename = "checked_utxo_mint_unknown")]
    CheckedUtxoMintUnknown { utxo: Utxo, account: Account },
    #[serde(rename = "created_consolidate_utxos_request")]
    CreatedConsolidateUtxosRequest {
        received_at: u64,
        block_index: u64,
        address: BitcoinAddress,
        amount: u64,
    },
    #[serde(rename = "reimbursed_failed_deposit")]
    ReimbursedFailedDeposit {
        burn_block_index: u64,
        mint_block_index: u64,
    },
    #[serde(rename = "reimbursed_withdrawal")]
    ReimbursedWithdrawal {
        burn_block_index: u64,
        mint_block_index: u64,
    },
}
#[derive(CandidType, Deserialize)]
pub struct Event {
    pub timestamp: Option<u64>,
    pub payload: EventType,
}
#[derive(CandidType, Deserialize)]
pub struct GetKnownUtxosArg {
    pub owner: Option<Principal>,
    pub subaccount: Option<serde_bytes::ByteBuf>,
}
#[derive(CandidType, Deserialize)]
pub struct MinterInfo {
    /// This amount is based on the `retrieve_btc_min_amount` setting during canister
    /// initialization or upgrades, but may vary according to current network fees.
    pub retrieve_btc_min_amount: u64,
    /// Minimal amount of BTC that can be deposited to be converted into ckBTC.
    /// UTXOs with lower values will be ignored.
    pub deposit_btc_min_amount: Option<u64>,
    pub min_confirmations: u32,
    /// The same as `check_fee`, but the old name is kept here to be backward compatible.
    pub kyt_fee: u64,
}
#[derive(CandidType, Deserialize)]
pub struct RetrieveBtcArgs {
    /// The address to which the ckBTC minter should deposit BTC.
    pub address: String,
    /// The amount of ckBTC in Satoshis that the client wants to withdraw.
    pub amount: u64,
}
#[derive(CandidType, Deserialize)]
pub struct RetrieveBtcOk {
    /// Returns the burn transaction index corresponding to the withdrawal.
    /// You can use this index to query the withdrawal status.
    pub block_index: u64,
}
#[derive(CandidType, Deserialize)]
pub enum RetrieveBtcError {
    /// The minter failed to parse the destination address.
    MalformedAddress(String),
    /// A generic error reserved for future extensions.
    GenericError {
        error_message: String,
        error_code: u64,
    },
    /// The minter is overloaded, retry the request.
    /// The payload contains a human-readable message explaining what caused the unavailability.
    TemporarilyUnavailable(String),
    /// The minter is already processing another retrieval request for the same
    /// principal.
    AlreadyProcessing,
    /// The withdrawal amount is too low.
    /// The payload contains the minimal withdrawal amount.
    AmountTooLow(u64),
    /// The ckBTC balance of the withdrawal account is too low.
    InsufficientFunds { balance: u64 },
}
#[derive(CandidType, Deserialize)]
pub struct RetrieveBtcStatusArg {
    pub block_index: u64,
}
#[derive(CandidType, Deserialize)]
pub enum RetrieveBtcStatus {
    /// The minter is obtaining all required ECDSA signatures on the
    /// Bitcoin transaction for this request.
    Signing,
    /// The minter received enough confirmations for the Bitcoin
    /// transaction for this request.  The payload contains the
    /// identifier of the transaction on the Bitcoin network.
    Confirmed { txid: serde_bytes::ByteBuf },
    /// The minter signed the transaction and is waiting for a reply
    /// from the Bitcoin canister.
    Sending { txid: serde_bytes::ByteBuf },
    /// The amount was too low to cover the transaction fees.
    AmountTooLow,
    /// The minter does not have any information on the specified
    /// retrieval request.  It can be that nobody submitted the
    /// request or the minter pruned the relevant information from the
    /// history to save space.
    Unknown,
    /// The minter sent a transaction for the retrieve request.
    /// The payload contains the identifier of the transaction on the Bitcoin network.
    Submitted { txid: serde_bytes::ByteBuf },
    /// The minter did not send a Bitcoin transaction for this request yet.
    Pending,
}
#[derive(CandidType, Deserialize)]
pub struct RetrieveBtcStatusV2Arg {
    pub block_index: u64,
}
#[derive(CandidType, Deserialize)]
pub struct ReimbursementRequest {
    pub account: Account,
    pub amount: u64,
    pub reason: ReimbursementReason,
}
#[derive(CandidType, Deserialize)]
pub struct ReimbursedDeposit {
    pub account: Account,
    pub mint_block_index: u64,
    pub amount: u64,
    pub reason: ReimbursementReason,
}
#[derive(CandidType, Deserialize)]
pub enum RetrieveBtcStatusV2 {
    /// The minter is obtaining all required ECDSA signatures on the
    /// Bitcoin transaction for this request.
    Signing,
    /// The minter received enough confirmations for the Bitcoin
    /// transaction for this request.  The payload contains the
    /// identifier of the transaction on the Bitcoin network.
    Confirmed { txid: serde_bytes::ByteBuf },
    /// The minter signed the transaction and is waiting for a reply
    /// from the Bitcoin canister.
    Sending { txid: serde_bytes::ByteBuf },
    /// The amount was too low to cover the transaction fees.
    AmountTooLow,
    /// / The minter will try to reimburse this transaction.
    WillReimburse(ReimbursementRequest),
    /// The minter does not have any information on the specified
    /// retrieval request.  It can be that nobody submitted the
    /// request or the minter pruned the relevant information from the
    /// history to save space.
    Unknown,
    /// The minter sent a transaction for the retrieve request.
    /// The payload contains the identifier of the transaction on the Bitcoin network.
    Submitted { txid: serde_bytes::ByteBuf },
    /// / The retrieve Bitcoin request has been reimbursed.
    Reimbursed(ReimbursedDeposit),
    /// The minter did not send a Bitcoin transaction for this request yet.
    Pending,
}
#[derive(CandidType, Deserialize)]
pub struct RetrieveBtcStatusV2ByAccountRetItem {
    pub block_index: u64,
    pub status_v2: Option<RetrieveBtcStatusV2>,
}
#[derive(CandidType, Deserialize)]
pub struct RetrieveBtcWithApprovalArgs {
    /// The subaccount to burn ckBTC from.
    pub from_subaccount: Option<serde_bytes::ByteBuf>,
    /// The address to which the ckBTC minter should deposit BTC.
    pub address: String,
    /// The amount of ckBTC in Satoshis that the client wants to withdraw.
    pub amount: u64,
}
#[derive(CandidType, Deserialize)]
pub enum RetrieveBtcWithApprovalError {
    /// The minter failed to parse the destination address.
    MalformedAddress(String),
    /// A generic error reserved for future extensions.
    GenericError {
        error_message: String,
        error_code: u64,
    },
    /// The minter is overloaded, retry the request.
    /// The payload contains a human-readable message explaining what caused the unavailability.
    TemporarilyUnavailable(String),
    /// The allowance given to the minter is too low.
    InsufficientAllowance { allowance: u64 },
    /// The minter is already processing another retrieval request for the same
    /// principal.
    AlreadyProcessing,
    /// The withdrawal amount is too low.
    /// The payload contains the minimal withdrawal amount.
    AmountTooLow(u64),
    /// The ckBTC balance of the withdrawal account is too low.
    InsufficientFunds { balance: u64 },
}
#[derive(CandidType, Deserialize)]
pub struct UpdateBalanceArg {
    pub owner: Option<Principal>,
    pub subaccount: Option<serde_bytes::ByteBuf>,
}
/// The result of an [update_balance] call.
#[derive(CandidType, Deserialize)]
pub enum UtxoStatus {
    /// The minter ignored this UTXO because UTXO's value is too small to pay
    /// the check fees.
    ValueTooSmall(Utxo),
    /// The Bitcoin checker considered this UTXO to be tainted.
    Tainted(Utxo),
    /// The UTXO passed the Bitcoin check, and ckBTC has been minted.
    Minted {
        minted_amount: u64,
        block_index: u64,
        utxo: Utxo,
    },
    /// The UTXO passed the Bitcoin check, but the minter failed to mint ckBTC
    /// because the Ledger was unavailable. Retrying the [update_balance] call
    /// should eventually advance the UTXO to the [Minted] state.
    Checked(Utxo),
}
/// Number of nanoseconds since the Unix Epoch
pub type Timestamp = u64;
#[derive(CandidType, Deserialize)]
pub struct SuspendedUtxo {
    pub utxo: Utxo,
    pub earliest_retry: Timestamp,
    pub reason: SuspendedReason,
}
#[derive(CandidType, Deserialize)]
pub struct PendingUtxoOutpoint {
    pub txid: serde_bytes::ByteBuf,
    pub vout: u32,
}
/// Utxos that don't have enough confirmations to be processed.
#[derive(CandidType, Deserialize)]
pub struct PendingUtxo {
    pub confirmations: u32,
    pub value: u64,
    pub outpoint: PendingUtxoOutpoint,
}
#[derive(CandidType, Deserialize)]
pub enum UpdateBalanceError {
    /// A generic error reserved for future extensions.
    GenericError {
        error_message: String,
        error_code: u64,
    },
    /// The minter is overloaded, retry the request.
    /// The payload contains a human-readable message explaining what caused the unavailability.
    TemporarilyUnavailable(String),
    /// The minter is already processing another update balance request for the caller.
    AlreadyProcessing,
    /// There are no new UTXOs to process.
    NoNewUtxos {
        suspended_utxos: Option<Vec<SuspendedUtxo>>,
        required_confirmations: u32,
        pending_utxos: Option<Vec<PendingUtxo>>,
        current_confirmations: Option<u32>,
    },
}

pub struct Service(pub Principal);
impl Service {
    /// Section "Transaction Information" {{{
    /// Returns information related to minter transactions.
    pub async fn decode_ledger_memo(
        &self,
        arg0: &DecodeLedgerMemoArgs,
    ) -> Result<(DecodeLedgerMemoResult,)> {
        ic_cdk::call(self.0, "decode_ledger_memo", (arg0,)).await
    }
    /// / Returns an estimate of the user's fee (in Satoshi) for a
    /// / retrieve_btc request based on the current status of the Bitcoin network.
    pub async fn estimate_withdrawal_fee(
        &self,
        arg0: &EstimateWithdrawalFeeArg,
    ) -> Result<(EstimateWithdrawalFeeRet,)> {
        ic_cdk::call(self.0, "estimate_withdrawal_fee", (arg0,)).await
    }
    /// Returns the Bitcoin address to which the owner should send BTC
    /// before converting the amount to ckBTC using the [update_balance]
    /// endpoint.
    ///
    /// If the owner is not set, it defaults to the caller's principal.
    /// The resolved owner must be a non-anonymous principal.
    pub async fn get_btc_address(&self, arg0: &GetBtcAddressArg) -> Result<(String,)> {
        ic_cdk::call(self.0, "get_btc_address", (arg0,)).await
    }
    pub async fn get_canister_status(&self) -> Result<(CanisterStatusResponse,)> {
        ic_cdk::call(self.0, "get_canister_status", ()).await
    }
    /// / Returns the fee that the minter will charge for a bitcoin deposit.
    pub async fn get_deposit_fee(&self) -> Result<(u64,)> {
        ic_cdk::call(self.0, "get_deposit_fee", ()).await
    }
    /// The minter keeps track of all state modifications in an internal event log.
    ///
    /// This method returns a list of events in the specified range.
    /// The minter can return fewer events than requested. The result is
    /// an empty vector if the start position is greater than the total
    /// number of events.
    ///
    /// NOTE: this method exists for debugging purposes.
    /// The ckBTC minter authors do not guarantee backward compatibility for this method.
    pub async fn get_events(&self, arg0: &GetEventsArg) -> Result<(Vec<Event>,)> {
        ic_cdk::call(self.0, "get_events", (arg0,)).await
    }
    /// Returns UTXOs of the given account known by the minter (with no
    /// guarantee in the ordering of the returned values).
    ///
    /// If the owner is not set, it defaults to the caller's principal.
    pub async fn get_known_utxos(&self, arg0: &GetKnownUtxosArg) -> Result<(Vec<Utxo>,)> {
        ic_cdk::call(self.0, "get_known_utxos", (arg0,)).await
    }
    /// Section "Minter Information" {{{
    /// Returns internal minter parameters.
    pub async fn get_minter_info(&self) -> Result<(MinterInfo,)> {
        ic_cdk::call(self.0, "get_minter_info", ()).await
    }
    /// Returns the account to which the caller should deposit ckBTC
    /// before withdrawing BTC using the [retrieve_btc] endpoint.
    pub async fn get_withdrawal_account(&self) -> Result<(Account,)> {
        ic_cdk::call(self.0, "get_withdrawal_account", ()).await
    }
    /// Submits a request to convert ckBTC to BTC.
    ///
    /// # Note
    ///
    /// The BTC retrieval process is slow.  Instead of
    /// synchronously waiting for a BTC transaction to settle, this
    /// method returns a request ([block_index]) that the caller can use
    /// to query the request status.
    ///
    /// # Preconditions
    ///
    /// * The caller deposited the requested amount in ckBTC to the account
    /// that the [get_withdrawal_account] endpoint returns.
    pub async fn retrieve_btc(
        &self,
        arg0: &RetrieveBtcArgs,
    ) -> Result<(std::result::Result<RetrieveBtcOk, RetrieveBtcError>,)> {
        ic_cdk::call(self.0, "retrieve_btc", (arg0,)).await
    }
    /// / [deprecated] Returns the status of a withdrawal request.
    /// / You should use retrieve_btc_status_v2 to retrieve the status of your withdrawal request.
    pub async fn retrieve_btc_status(
        &self,
        arg0: &RetrieveBtcStatusArg,
    ) -> Result<(RetrieveBtcStatus,)> {
        ic_cdk::call(self.0, "retrieve_btc_status", (arg0,)).await
    }
    /// / Returns the status of a withdrawal request request using the RetrieveBtcStatusV2 type.
    pub async fn retrieve_btc_status_v2(
        &self,
        arg0: &RetrieveBtcStatusV2Arg,
    ) -> Result<(RetrieveBtcStatusV2,)> {
        ic_cdk::call(self.0, "retrieve_btc_status_v2", (arg0,)).await
    }
    /// Returns the withdrawal statues by account.
    ///
    /// # Note
    /// The _v2_ part indicates that you get a response in line with the retrieve_btc_status_v2 endpoint,
    /// i.e., you get a vector of RetrieveBtcStatusV2 and not RetrieveBtcStatus.
    ///
    pub async fn retrieve_btc_status_v2_by_account(
        &self,
        arg0: &Option<Account>,
    ) -> Result<(Vec<RetrieveBtcStatusV2ByAccountRetItem>,)> {
        ic_cdk::call(self.0, "retrieve_btc_status_v2_by_account", (arg0,)).await
    }
    /// Submits a request to convert ckBTC to BTC.
    ///
    /// # Note
    ///
    /// The BTC retrieval process is slow.  Instead of
    /// synchronously waiting for a BTC transaction to settle, this
    /// method returns a request ([block_index]) that the caller can use
    /// to query the request status.
    ///
    /// # Preconditions
    ///
    /// * The caller allowed the minter's principal to spend its funds
    /// using [icrc2_approve] on the ckBTC ledger.
    pub async fn retrieve_btc_with_approval(
        &self,
        arg0: &RetrieveBtcWithApprovalArgs,
    ) -> Result<(std::result::Result<RetrieveBtcOk, RetrieveBtcWithApprovalError>,)> {
        ic_cdk::call(self.0, "retrieve_btc_with_approval", (arg0,)).await
    }
    /// Mints ckBTC for newly deposited UTXOs.
    ///
    /// If the owner is not set, it defaults to the caller's principal.
    ///
    /// # Preconditions
    ///
    /// * The owner deposited some BTC to the address that the
    /// [get_btc_address] endpoint returns.
    pub async fn update_balance(
        &self,
        arg0: &UpdateBalanceArg,
    ) -> Result<(std::result::Result<Vec<UtxoStatus>, UpdateBalanceError>,)> {
        ic_cdk::call(self.0, "update_balance", (arg0,)).await
    }
}
