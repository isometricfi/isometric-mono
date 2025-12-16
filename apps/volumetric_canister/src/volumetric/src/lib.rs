use std::time::Duration;

use candid::{Nat, Principal};
use ic_cdk::export_candid;
use ic_cdk::init;

pub mod api;
pub mod auth;
pub mod errors;
pub mod generated;
pub mod guards;
pub mod oracle;
pub mod storage;
pub mod usecases;

pub use api::accounts::{ProfileInfo, UserInfo};
pub use api::deposits::DepositInfo;
pub use api::withdrawals::WithdrawResult;
pub use api::{
    accept_offers, cancel_offer, create_offer, get_active_option_by_id, get_cancel_offer_message,
    get_create_offer_message, get_my_offers, get_my_options, get_my_written_options,
    get_offer_by_id, get_open_offers, get_pending_settlements, settle_expired_options,
    settle_option_by_id, testing_expire_option, testing_force_settle, testing_set_option_expiry,
    AcceptOfferItem, AcceptOffersRequest, AcceptOffersResponse, CancelOfferRequest,
    CreateOfferRequest, CreateOfferResponse, SettleExpiredOptionsResponse, SettlementResult,
};
pub use api::{
    add_whitelisted, create_account, get_account_info, get_account_nonce, get_ckbtc_balance,
    get_config, get_deposit_address, get_message_to_sign, get_username_update_message,
    get_withdraw_message, list_users, list_whitelisted, remove_whitelisted, set_oracle_price,
    set_temp, testing_sync_balance_from_ledger, update_ckbtc_balance, update_username,
    withdraw_ckbtc,
};
pub use auth::types::{
    AuthenticatedPayload, CreateProfileRequest, UpdateUsernameRequest, WithdrawCkbtcRequest,
};
pub use errors::VolumetricError;
pub use generated::ckbtc::{Utxo, UtxoOutpoint, UtxoStatus};
pub use storage::{
    ActiveOption, ActiveOptionStatus, Asset, BtcNetwork, Offer, OfferStatus, OptionType,
    UserBalance, MINIMUM_QUANTITY_SATS,
};

use crate::storage::{Cbor, Config, CONFIG};

const INIT_DELAY_SECS: u64 = 0;

#[init]
fn init(btc_network: Option<BtcNetwork>) {
    let network = btc_network.unwrap_or_default();
    ic_cdk_timers::set_timer(Duration::from_secs(INIT_DELAY_SECS), async move {
        let new_config = Config::new(network);

        CONFIG.with_borrow_mut(|config| {
            let _ = config.set(Cbor(new_config));
        });
    });

    api::setup_settlement_timer();
}

#[ic_cdk::query]
fn greet(name: String) -> String {
    format!("Volumetric, {}!", name)
}

export_candid!();
