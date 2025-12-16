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

#[derive(Debug, Deserialize, Serialize, CandidType, Clone, Copy, Default)]
pub struct FeatureFlags {
    pub is_partial_filling_enabled: bool,
    pub is_stitching_enabled: bool,
}

#[derive(Debug, Deserialize, Serialize, CandidType, Clone)]
pub struct Config {
    pub btc_network: BtcNetwork,
    pub ckbtc_minter: Principal,
    pub ckbtc_ledger: Principal,
    #[serde(default)]
    pub feature_flags: FeatureFlags,
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
            btc_network: network,
            ckbtc_minter: Principal::from_text(minter).unwrap(),
            ckbtc_ledger: Principal::from_text(ledger).unwrap(),
            feature_flags: FeatureFlags::default(),
        }
    }
}

impl Config {
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

    pub fn feature_flags() -> FeatureFlags {
        CONFIG.with_borrow(|c| c.get().0.feature_flags.clone())
    }

    pub fn set_feature_flags(flags: FeatureFlags) {
        CONFIG.with_borrow_mut(|c| {
            let mut config = c.get().0.clone();
            config.feature_flags = flags;
            let _ = c.set(Cbor(config));
        });
    }

    pub fn is_partial_filling_enabled() -> bool {
        CONFIG.with_borrow(|c| c.get().0.feature_flags.is_partial_filling_enabled)
    }

    pub fn is_stitching_enabled() -> bool {
        CONFIG.with_borrow(|c| c.get().0.feature_flags.is_stitching_enabled)
    }
}
