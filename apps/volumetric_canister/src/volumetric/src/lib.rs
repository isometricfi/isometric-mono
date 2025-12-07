use std::time::Duration;

use candid::Principal;
use ic_cdk::export_candid;
use ic_cdk::init;

pub mod api;
pub mod errors;
pub mod guards;
pub mod storage;

pub use api::{add_whitelisted, get_config, list_whitelisted, remove_whitelisted, set_temp};
pub use errors::VolumetricError;

use crate::storage::{Cbor, Config, CONFIG};

#[init]
fn init() {
    ic_cdk_timers::set_timer(Duration::from_secs(0), async {
        let new_config = Config {
            ..Default::default()
        };

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
