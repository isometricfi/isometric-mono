use crate::ic;
use crate::storage::{get_nonce, BtcNetwork, Config};

use super::types::{ChallengeContext, WalletKey};

pub fn build_challenge_context(wallet_key: &WalletKey) -> ChallengeContext {
    let nonce = get_nonce(wallet_key);
    let network = match Config::btc_network() {
        BtcNetwork::Mainnet => "mainnet",
        BtcNetwork::Testnet => "testnet",
    };

    ChallengeContext {
        canister_id: ic::canister_self().to_text(),
        network,
        nonce,
    }
}
