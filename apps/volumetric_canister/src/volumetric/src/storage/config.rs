use candid::CandidType;
use serde::{Deserialize, Serialize};

use super::state::CONFIG;
use super::Cbor;

#[derive(Debug, Deserialize, Serialize, CandidType, Clone, Default)]
pub struct Config {
    pub temp: String,
}

impl Config {
    pub fn temp() -> String {
        CONFIG.with_borrow(|c| c.get().0.temp.clone())
    }

    pub fn set_temp(value: String) {
        CONFIG.with_borrow_mut(|c| {
            let mut config = c.get().0.clone();
            config.temp = value;
            let _ = c.set(Cbor(config));
        });
    }

    pub fn get() -> Self {
        CONFIG.with_borrow(|c| c.get().0.clone())
    }
}
