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

#[derive(Debug, Deserialize, Serialize, CandidType, Clone, Copy)]
pub struct Range<T> {
    pub min: T,
    pub max: T,
}

#[derive(Debug, Deserialize, Serialize, CandidType, Clone, Copy)]
pub struct TradingLimits {
    pub quantity_sats: Range<u64>,
    pub premium_basis_points: Range<u16>,
    pub strike_basis_points: Range<u16>,
    pub option_duration_seconds: Range<u64>,
    pub term_days: Range<u64>,
    pub deposit_amount_sats: u64,
    pub withdraw_amount_sats: u64,
    #[serde(default = "default_max_offers_per_term")]
    pub max_offers_per_term: usize,
}

fn default_max_offers_per_term() -> usize {
    5
}

impl Default for TradingLimits {
    fn default() -> Self {
        Self {
            quantity_sats: Range {
                min: 90_000,
                max: 100_000_000,
            },
            premium_basis_points: Range {
                min: 50,
                max: 10_000,
            },
            strike_basis_points: Range {
                min: 500,
                max: 10_000,
            },
            option_duration_seconds: Range {
                min: 60,
                max: 86400 * 30,
            },
            term_days: Range { min: 1, max: 30 },
            deposit_amount_sats: 50_000,
            withdraw_amount_sats: 50_000,
            max_offers_per_term: 5,
        }
    }
}

#[derive(Debug, Deserialize, Serialize, CandidType, Clone)]
pub struct Config {
    pub btc_network: BtcNetwork,
    pub ckbtc_minter: Principal,
    pub ckbtc_ledger: Principal,
    #[serde(default)]
    pub feature_flags: FeatureFlags,
    #[serde(default)]
    pub trading_limits: TradingLimits,
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
            trading_limits: TradingLimits::default(),
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

    pub fn trading_limits() -> TradingLimits {
        CONFIG.with_borrow(|c| c.get().0.trading_limits)
    }

    pub fn set_trading_limits(limits: TradingLimits) {
        CONFIG.with_borrow_mut(|c| {
            let mut config = c.get().0.clone();
            config.trading_limits = limits;
            let _ = c.set(Cbor(config));
        });
    }

    pub fn set_quantity_sats_range(min: u64, max: u64) {
        CONFIG.with_borrow_mut(|c| {
            let mut config = c.get().0.clone();
            config.trading_limits.quantity_sats = Range { min, max };
            let _ = c.set(Cbor(config));
        });
    }

    pub fn set_premium_basis_points_range(min: u16, max: u16) {
        CONFIG.with_borrow_mut(|c| {
            let mut config = c.get().0.clone();
            config.trading_limits.premium_basis_points = Range { min, max };
            let _ = c.set(Cbor(config));
        });
    }

    pub fn set_strike_basis_points_range(min: u16, max: u16) {
        CONFIG.with_borrow_mut(|c| {
            let mut config = c.get().0.clone();
            config.trading_limits.strike_basis_points = Range { min, max };
            let _ = c.set(Cbor(config));
        });
    }

    pub fn set_option_duration_seconds_range(min: u64, max: u64) {
        CONFIG.with_borrow_mut(|c| {
            let mut config = c.get().0.clone();
            config.trading_limits.option_duration_seconds = Range { min, max };
            let _ = c.set(Cbor(config));
        });
    }

    pub fn set_term_days_range(min: u64, max: u64) {
        CONFIG.with_borrow_mut(|c| {
            let mut config = c.get().0.clone();
            config.trading_limits.term_days = Range { min, max };
            let _ = c.set(Cbor(config));
        });
    }

    pub fn set_deposit_amount_sats(amount: u64) {
        CONFIG.with_borrow_mut(|c| {
            let mut config = c.get().0.clone();
            config.trading_limits.deposit_amount_sats = amount;
            let _ = c.set(Cbor(config));
        });
    }

    pub fn set_withdraw_amount_sats(amount: u64) {
        CONFIG.with_borrow_mut(|c| {
            let mut config = c.get().0.clone();
            config.trading_limits.withdraw_amount_sats = amount;
            let _ = c.set(Cbor(config));
        });
    }

    pub fn set_max_offers_per_term(max: usize) {
        CONFIG.with_borrow_mut(|c| {
            let mut config = c.get().0.clone();
            config.trading_limits.max_offers_per_term = max;
            let _ = c.set(Cbor(config));
        });
    }
}
