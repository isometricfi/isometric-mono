use crate::errors::{error_codes, VolumetricError};
use crate::ic;
use crate::storage::{get_nonce, BtcNetwork, Config};

use super::types::{ChallengeContext, WalletKey};

/// Maximum lifetime a client can ask for on a signed challenge.
///
/// Ten minutes is long enough to survive a slow wallet confirmation flow and
/// a slow internet uplink, but short enough that an abandoned signed
/// authorization can't be replayed later (the nonce is still the primary
/// defense; expiry is belt-and-suspenders).
pub const MAX_CHALLENGE_LIFETIME_SECONDS: u64 = 600;

pub fn build_challenge_context(
    wallet_key: &WalletKey,
    expires_at_seconds: u64,
) -> ChallengeContext {
    let nonce = get_nonce(wallet_key);
    let network = match Config::btc_network() {
        BtcNetwork::Mainnet => "mainnet",
        BtcNetwork::Testnet => "testnet",
    };

    ChallengeContext {
        canister_id: ic::canister_self().to_text(),
        network,
        nonce,
        expires_at_seconds,
    }
}

/// Validates that the client-supplied expiry falls within the permitted window.
///
/// - Must be strictly in the future.
/// - Must not sit further than [`MAX_CHALLENGE_LIFETIME_SECONDS`] past now.
///
/// Rejecting "far future" expiries prevents a client from minting a signature
/// with a year-long validity that could be replayed if a nonce ever rolled.
pub fn ensure_challenge_fresh(expires_at_seconds: u64) -> Result<(), VolumetricError> {
    const NANOS_PER_SECOND: u64 = 1_000_000_000;
    let now_seconds = ic::time() / NANOS_PER_SECOND;

    if expires_at_seconds <= now_seconds {
        return Err(VolumetricError::from_def(
            error_codes::CHALLENGE_EXPIRED,
            Some("expires_at_seconds is in the past"),
            None,
        ));
    }
    if expires_at_seconds > now_seconds.saturating_add(MAX_CHALLENGE_LIFETIME_SECONDS) {
        return Err(VolumetricError::from_def(
            error_codes::CHALLENGE_EXPIRED,
            Some(&format!(
                "expires_at_seconds is more than {} seconds in the future",
                MAX_CHALLENGE_LIFETIME_SECONDS
            )),
            None,
        ));
    }
    Ok(())
}
