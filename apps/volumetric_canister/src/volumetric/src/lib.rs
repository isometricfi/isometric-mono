use crate::journaling::OperationId;
use candid::{Nat, Principal};
use ic_cdk::export_candid;
use ic_cdk::{init, post_upgrade};

pub mod api;
pub mod auth;
pub mod errors;
pub mod generated;
pub mod guards;
pub mod ic;
mod ic_async_timer;
pub mod journaling;
pub mod ledger;
pub mod locks;
pub mod minter;
pub mod observability;
pub mod oracle;
pub mod storage;
pub mod time;
pub mod timers;
pub mod usecases;

pub use api::accounts::{ProfileInfo, UserInfo};
pub use api::deposits::DepositInfo;
pub use api::{
    accept_offers, cancel_offer, create_offer, get_accept_by_id, get_accept_offers_message,
    get_accept_status, get_active_option_by_id, get_cancel_offer_message, get_create_offer_message,
    get_failed_accepts, get_failed_settlements, get_my_offers, get_my_options,
    get_my_written_options, get_offer_by_id, get_open_offers, get_pending_accepts,
    get_pending_settlements, get_pending_settlements_journal, get_recovery_required_wal_entries,
    get_settlement_by_id, get_settlement_status, recover_wal_operation, settle_expired_options,
    settle_option_by_id, AcceptOfferItem, AcceptOffersRequest, CancelOfferRequest,
    CreateOfferRequest, CreateOfferResponse, SettleExpiredOptionsResponse, SettlementResult,
};
pub use api::{
    add_whitelisted, clear_log_access_token, create_account, get_account_info, get_account_nonce,
    get_ckbtc_balance, get_config, get_deposit_address, get_failed_withdrawals, get_feature_flags,
    get_latest_xrc_btc_usd_rate, get_message_to_sign, get_my_pending_withdrawals,
    get_my_pending_withdrawals_message, get_pending_withdrawals, get_trading_limits,
    get_user_balance, get_username_update_message, get_withdraw_message, get_withdraw_status,
    get_withdrawal_by_id, list_users, list_whitelisted, remove_whitelisted,
    set_feature_flags_config, set_log_access_token, set_trading_limits_config,
    update_ckbtc_balance, update_username, validate_invite_code, withdraw_ckbtc, UserBalanceInfo,
};
#[cfg(feature = "testing")]
pub use api::{
    testing_clear_offers_and_options, testing_expire_option, testing_force_settle,
    testing_reset_oracle, testing_set_ckbtc_ledger, testing_set_option_expiry_seconds,
    testing_set_oracle_price_cents, testing_sync_balance_from_ledger, ClearStorageResponse,
};
pub use auth::types::{
    AuthenticatedPayload, CreateProfileRequest, ListMyPendingWithdrawalsRequest,
    UpdateUsernameRequest, WithdrawCkbtcRequest,
};
pub use errors::VolumetricError;
pub use generated::ckbtc::{Utxo, UtxoOutpoint, UtxoStatus};
pub use journaling::WalExecutionOutcome;
pub use observability::{http_request, observability_get_metrics, ObservabilityMetrics};
pub use storage::{
    AcceptPhase, ActiveOption, ActiveOptionStatus, Asset, BtcNetwork, Event, EventData, EventType,
    FeatureFlags, FeeConfig, Offer, OfferStatus, OptionType, PendingAccept, PendingSettlement,
    PendingWithdrawal, SettlementPhase, StoredXrcBtcUsdRate, TradeRole, TradingLimits, UserBalance,
    WithdrawalPhase, MINIMUM_QUANTITY_SATS,
};
pub use usecases::{
    AcceptOffersReceipt, AcceptOffersResult, AcceptOffersStatus, SettlementReceipt,
    SettlementStatus, WithdrawReceipt, WithdrawResult, WithdrawStatus,
};

use crate::storage::{Cbor, Config, CONFIG};

#[init]
fn init(btc_network: Option<BtcNetwork>) {
    let network = btc_network.unwrap_or_default();
    let new_config = Config::new(network);

    CONFIG.with_borrow_mut(|config| {
        let _ = config.set(Cbor(new_config));
    });

    timers::setup_timers();
}

#[post_upgrade]
fn post_upgrade() {
    timers::setup_timers();
}

export_candid!();
