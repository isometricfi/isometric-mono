use std::time::Duration;

use candid::Principal;
use ic_cdk::export_candid;
use ic_cdk::init;

pub mod api;
pub mod auth;
pub mod errors;
pub mod guards;
pub mod storage;

pub use api::accounts::{ProfileInfo, UserInfo};
pub use api::{
    add_whitelisted, create_account, get_account_info, get_account_nonce, get_config,
    get_message_to_sign, get_username_update_message, list_users, list_whitelisted,
    remove_whitelisted, set_temp, update_username,
};
pub use auth::types::{AuthenticatedPayload, CreateProfileRequest, UpdateUsernameRequest};
pub use errors::VolumetricError;

use crate::storage::{Cbor, Config, CONFIG};

const INIT_DELAY_SECS: u64 = 0;

#[init]
fn init() {
    ic_cdk_timers::set_timer(Duration::from_secs(INIT_DELAY_SECS), async {
        let new_config = Config::default();

        CONFIG.with_borrow_mut(|config| {
            let _ = config.set(Cbor(new_config));
        });
    });
}

#[ic_cdk::query]
fn greet(name: String) -> String {
    format!("Volumetric, {}!", name)
}

export_candid!();
