use candid::{CandidType, Principal};
use serde::{Deserialize, Serialize};

use super::state::CONFIG;
use super::Cbor;

// https://dashboard.internetcomputer.org/bitcoin
const CKBTC_MINTER_MAINNET: &str = "mqygn-kiaaa-aaaar-qaadq-cai";
const CKBTC_LEDGER_MAINNET: &str = "mxzaz-hqaaa-aaaar-qaada-cai";

// https://dashboard.internetcomputer.org/bitcoin (testnet4)
const CKTESTBTC_MINTER: &str = "ml52i-qqaaa-aaaar-qaaba-cai";
const CKTESTBTC_LEDGER: &str = "mc6ru-gyaaa-aaaar-qaaaq-cai";

#[derive(Debug, Deserialize, Serialize, CandidType, Clone, Copy, PartialEq, Eq, Default)]
pub enum BtcNetwork {
    Mainnet,
    #[default]
    Testnet,
}

#[derive(Debug, Deserialize, Serialize, CandidType, Clone)]
pub struct Config {
    pub temp: String,
    pub btc_network: BtcNetwork,
    pub ckbtc_minter: Principal,
    pub ckbtc_ledger: Principal,
}

impl Default for Config {
    fn default() -> Self {
        Self::new(BtcNetwork::default())
    }
}

impl Config {
    pub fn new(network: BtcNetwork) -> Self {
        let (minter, ledger) = match network {
            BtcNetwork::Mainnet => (CKBTC_MINTER_MAINNET, CKBTC_LEDGER_MAINNET),
            BtcNetwork::Testnet => (CKTESTBTC_MINTER, CKTESTBTC_LEDGER),
        };
        Self {
            temp: String::new(),
            btc_network: network,
            ckbtc_minter: Principal::from_text(minter).unwrap(),
            ckbtc_ledger: Principal::from_text(ledger).unwrap(),
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

    pub fn btc_network() -> BtcNetwork {
        CONFIG.with_borrow(|c| c.get().0.btc_network)
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
