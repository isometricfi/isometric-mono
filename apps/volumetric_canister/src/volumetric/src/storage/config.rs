use candid::{CandidType, Principal};
use serde::{Deserialize, Serialize};

use super::state::CONFIG;
use super::Cbor;

// https://dashboard.internetcomputer.org/bitcoin
const CKBTC_MINTER_MAINNET: &str = "mqygn-kiaaa-aaaar-qaadq-cai";
const CKBTC_LEDGER_MAINNET: &str = "mxzaz-hqaaa-aaaar-qaada-cai";

#[derive(Debug, Deserialize, Serialize, CandidType, Clone)]
pub struct Config {
    pub temp: String,
    pub ckbtc_minter: Principal,
    pub ckbtc_ledger: Principal,
}

impl Default for Config {
    fn default() -> Self {
        Self {
            temp: String::new(),
            ckbtc_minter: Principal::from_text(CKBTC_MINTER_MAINNET).unwrap(),
            ckbtc_ledger: Principal::from_text(CKBTC_LEDGER_MAINNET).unwrap(),
        }
    }
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

    pub fn ckbtc_minter() -> Principal {
        CONFIG.with_borrow(|c| c.get().0.ckbtc_minter)
    }

    pub fn ckbtc_ledger() -> Principal {
        CONFIG.with_borrow(|c| c.get().0.ckbtc_ledger)
    }
    
    pub fn get() -> Self {
        CONFIG.with_borrow(|c| c.get().0.clone())
    }
}
