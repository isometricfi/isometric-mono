use std::borrow::Cow;

use candid::CandidType;
use ic_stable_structures::storable::Bound;
use ic_stable_structures::Storable;
use serde::{Deserialize, Serialize};

use crate::errors::{error_codes, VolumetricError};

const WALLET_KEY_SIZE: usize = 64;
const MAX_WALLET_ADDRESS_BYTES: usize = WALLET_KEY_SIZE;
const CHALLENGE_VERSION_TAG: &str = "btc-auth-v1";

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub struct WalletKey([u8; WALLET_KEY_SIZE]);

impl WalletKey {
    pub fn try_from_address(address: &str) -> Result<Self, VolumetricError> {
        let normalized_address = address.trim();
        if normalized_address.is_empty() {
            return Err(VolumetricError::from_def(
                error_codes::INVALID_WALLET_ADDRESS,
                Some("Wallet address cannot be empty"),
                None,
            ));
        }

        let address_bytes = normalized_address.as_bytes();
        if address_bytes.len() > MAX_WALLET_ADDRESS_BYTES {
            return Err(VolumetricError::from_def(
                error_codes::INVALID_WALLET_ADDRESS,
                Some("Wallet address exceeds maximum supported length of 64 bytes"),
                None,
            ));
        }

        let zero_padding: u8 = 0;
        let mut bytes = [zero_padding; WALLET_KEY_SIZE];
        bytes[..address_bytes.len()].copy_from_slice(address_bytes);
        Ok(Self(bytes))
    }

    pub fn to_address(&self) -> String {
        let first_null = self.0.iter().position(|&b| b == 0);
        let end = first_null.unwrap_or(WALLET_KEY_SIZE);
        String::from_utf8_lossy(&self.0[..end]).to_string()
    }
}

impl CandidType for WalletKey {
    fn _ty() -> candid::types::Type {
        <Vec<u8> as CandidType>::ty()
    }

    fn idl_serialize<S>(&self, serializer: S) -> Result<(), S::Error>
    where
        S: candid::types::Serializer,
    {
        serializer.serialize_blob(&self.0)
    }
}

impl Serialize for WalletKey {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_bytes(&self.0)
    }
}

impl<'de> Deserialize<'de> for WalletKey {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        struct WalletKeyVisitor;

        impl<'de> serde::de::Visitor<'de> for WalletKeyVisitor {
            type Value = WalletKey;

            fn expecting(&self, formatter: &mut std::fmt::Formatter) -> std::fmt::Result {
                write!(formatter, "{} bytes", WALLET_KEY_SIZE)
            }

            fn visit_bytes<E>(self, v: &[u8]) -> Result<Self::Value, E>
            where
                E: serde::de::Error,
            {
                if v.len() != WALLET_KEY_SIZE {
                    return Err(E::invalid_length(v.len(), &self));
                }
                let mut arr = [0u8; WALLET_KEY_SIZE];
                arr.copy_from_slice(v);
                Ok(WalletKey(arr))
            }

            fn visit_seq<A>(self, mut seq: A) -> Result<Self::Value, A::Error>
            where
                A: serde::de::SeqAccess<'de>,
            {
                let mut arr = [0u8; WALLET_KEY_SIZE];
                for (i, byte) in arr.iter_mut().enumerate() {
                    *byte = seq
                        .next_element()?
                        .ok_or_else(|| serde::de::Error::invalid_length(i, &self))?;
                }
                Ok(WalletKey(arr))
            }
        }

        deserializer.deserialize_bytes(WalletKeyVisitor)
    }
}

impl Storable for WalletKey {
    fn to_bytes(&self) -> Cow<'_, [u8]> {
        Cow::Borrowed(&self.0)
    }

    fn from_bytes(bytes: Cow<[u8]>) -> Self {
        let mut arr = [0u8; WALLET_KEY_SIZE];
        arr.copy_from_slice(&bytes);
        Self(arr)
    }

    fn into_bytes(self) -> Vec<u8> {
        self.0.to_vec()
    }

    const BOUND: Bound = Bound::Bounded {
        max_size: WALLET_KEY_SIZE as u32,
        is_fixed_size: true,
    };
}

#[derive(Debug, Clone, CandidType, Serialize, Deserialize)]
pub struct WalletProof {
    pub address: String,
    pub signature: String,
}

#[derive(Debug, Clone, CandidType, Serialize, Deserialize)]
pub struct AuthenticatedPayload<T> {
    pub data: T,
    pub wallet_proof: WalletProof,
}

/// Context threaded through every signing-message construction. The canister
/// reconstructs the exact bytes the client signed by combining this context
/// with the typed action payload.
#[derive(Debug, Clone)]
pub struct ChallengeContext {
    pub canister_id: String,
    pub network: &'static str,
    pub nonce: u64,
    pub expires_at_seconds: u64,
}

/// Actions that can be authorized by a Bitcoin signature.
///
/// Implementors supply a stable action name and a list of action-specific
/// key/value pairs. The canonical challenge string is assembled by
/// [`build_challenge_message`] so every action shares the same framing.
pub trait SignableAction {
    const ACTION_NAME: &'static str;

    fn action_fields(&self) -> Vec<(&'static str, String)>;
}

/// Builds the exact bytes the client must sign for an authorized action.
///
/// Format (one field per line, LF-separated, no trailing newline):
/// ```text
/// btc-auth-v1
/// action=<action_name>
/// address=<btc_addr>
/// canister=<canister_id>
/// expires_at=<unix_seconds>
/// network=<mainnet|testnet>
/// nonce=<u64>
/// <action-specific key=value lines, alphabetized>
/// ```
///
/// Framing fields are alphabetized so any mis-order between client and server
/// fails loudly at the byte-compare step. Action fields are also alphabetized
/// before they are appended, so implementors don't need to worry about order.
///
/// Returns an error if any field value contains a newline or the '=' character,
/// since either would break the framing.
pub fn build_challenge_message<A: SignableAction>(
    action: &A,
    address: &str,
    context: &ChallengeContext,
) -> Result<String, VolumetricError> {
    let mut framing: Vec<(&'static str, String)> = vec![
        ("action", A::ACTION_NAME.to_string()),
        ("address", address.to_string()),
        ("canister", context.canister_id.clone()),
        ("expires_at", context.expires_at_seconds.to_string()),
        ("network", context.network.to_string()),
        ("nonce", context.nonce.to_string()),
    ];
    framing.sort_by_key(|(key, _)| *key);

    let mut action_fields = action.action_fields();
    action_fields.sort_by_key(|(key, _)| *key);

    let mut out = String::from(CHALLENGE_VERSION_TAG);
    for (key, value) in framing.iter().chain(action_fields.iter()) {
        validate_signable_field(key, value)?;
        out.push('\n');
        out.push_str(key);
        out.push('=');
        out.push_str(value);
    }
    Ok(out)
}

fn validate_signable_field(key: &str, value: &str) -> Result<(), VolumetricError> {
    if value.contains('\n') || value.contains('\r') || value.contains('=') {
        return Err(VolumetricError::from_def(
            error_codes::INVALID_SIGNING_FIELD,
            Some(&format!(
                "field '{}' contains a disallowed character (newline or '=')",
                key
            )),
            None,
        ));
    }
    Ok(())
}

#[derive(Debug, Clone, CandidType, Serialize, Deserialize)]
pub struct CreateProfileRequest {
    pub invite_code: Option<String>,
    pub expires_at_seconds: u64,
}

impl SignableAction for CreateProfileRequest {
    const ACTION_NAME: &'static str = "create_account";

    fn action_fields(&self) -> Vec<(&'static str, String)> {
        vec![("invite_code", self.invite_code.clone().unwrap_or_default())]
    }
}

#[derive(Debug, Clone, CandidType, Serialize, Deserialize)]
pub struct UpdateUsernameRequest {
    pub username: String,
    pub expires_at_seconds: u64,
}

impl SignableAction for UpdateUsernameRequest {
    const ACTION_NAME: &'static str = "update_username";

    fn action_fields(&self) -> Vec<(&'static str, String)> {
        vec![("username", self.username.clone())]
    }
}

#[derive(Debug, Clone, CandidType, Serialize, Deserialize)]
pub struct WithdrawCkbtcRequest {
    pub amount: u64,
    pub expires_at_seconds: u64,
}

impl SignableAction for WithdrawCkbtcRequest {
    const ACTION_NAME: &'static str = "withdraw_ckbtc";

    fn action_fields(&self) -> Vec<(&'static str, String)> {
        vec![("amount_sats", self.amount.to_string())]
    }
}

#[derive(Debug, Clone, CandidType, Serialize, Deserialize)]
pub struct ListMyPendingWithdrawalsRequest {
    pub expires_at_seconds: u64,
}

impl SignableAction for ListMyPendingWithdrawalsRequest {
    const ACTION_NAME: &'static str = "list_my_pending_withdrawals";

    fn action_fields(&self) -> Vec<(&'static str, String)> {
        vec![]
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const VALID_ADDRESS: &str = "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh";

    fn test_context() -> ChallengeContext {
        ChallengeContext {
            canister_id: "aaaaa-aa".to_string(),
            network: "mainnet",
            nonce: 7,
            expires_at_seconds: 1_700_000_000,
        }
    }

    #[test]
    fn wallet_key_try_from_address_should_reject_overlong_addresses() {
        // given
        const PREFIX_64_BYTES: &str =
            "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
        let first_address = format!("{PREFIX_64_BYTES}11111111");

        // when
        let result = WalletKey::try_from_address(&first_address);

        // then
        assert!(result.is_err());
    }

    #[test]
    fn wallet_key_try_from_address_should_be_deterministic_for_valid_addresses() {
        // given / when
        let first_wallet_key = WalletKey::try_from_address(VALID_ADDRESS).unwrap();
        let second_wallet_key = WalletKey::try_from_address(VALID_ADDRESS).unwrap();

        // then
        assert_eq!(first_wallet_key, second_wallet_key);
    }

    #[test]
    fn wallet_key_try_from_address_should_trim_input() {
        // given
        const VALID_ADDRESS_WITH_SPACES: &str = "  bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh  ";

        // when
        let first_wallet_key = WalletKey::try_from_address(VALID_ADDRESS_WITH_SPACES).unwrap();
        let second_wallet_key = WalletKey::try_from_address(VALID_ADDRESS).unwrap();

        // then
        assert_eq!(first_wallet_key, second_wallet_key);
    }

    #[test]
    fn build_challenge_message_is_deterministic_and_versioned() {
        // given
        let context = test_context();
        let request = WithdrawCkbtcRequest {
            amount: 42_000,
            expires_at_seconds: context.expires_at_seconds,
        };

        // when
        let first = build_challenge_message(&request, VALID_ADDRESS, &context).unwrap();
        let second = build_challenge_message(&request, VALID_ADDRESS, &context).unwrap();

        // then
        assert_eq!(first, second);
        assert!(first.starts_with("btc-auth-v1\n"));
        assert!(first.contains("\naction=withdraw_ckbtc\n"));
        assert!(first.contains(&format!("\nnonce={}\n", context.nonce)));
        assert!(first.contains(&format!("\nexpires_at={}\n", context.expires_at_seconds)));
        assert!(first.contains("\namount_sats=42000"));
    }

    #[test]
    fn build_challenge_message_includes_list_my_pending_withdrawals_action() {
        // given
        let context = test_context();
        let request = ListMyPendingWithdrawalsRequest {
            expires_at_seconds: context.expires_at_seconds,
        };

        // when
        let message = build_challenge_message(&request, VALID_ADDRESS, &context).unwrap();

        // then
        assert!(message.contains("\naction=list_my_pending_withdrawals\n"));
    }

    #[test]
    fn build_challenge_message_differs_when_any_field_changes() {
        // given
        let context = test_context();
        let base = WithdrawCkbtcRequest {
            amount: 1_000,
            expires_at_seconds: context.expires_at_seconds,
        };
        let mutated_amount = WithdrawCkbtcRequest {
            amount: 1_001,
            ..base.clone()
        };
        let mutated_context = ChallengeContext {
            nonce: context.nonce + 1,
            ..context.clone()
        };

        // when
        let baseline = build_challenge_message(&base, VALID_ADDRESS, &context).unwrap();
        let amount_changed =
            build_challenge_message(&mutated_amount, VALID_ADDRESS, &context).unwrap();
        let nonce_changed =
            build_challenge_message(&base, VALID_ADDRESS, &mutated_context).unwrap();

        // then
        assert_ne!(baseline, amount_changed);
        assert_ne!(baseline, nonce_changed);
    }

    #[test]
    fn build_challenge_message_rejects_newline_in_action_field() {
        // given
        let context = test_context();
        let malicious = UpdateUsernameRequest {
            username: "foo\nnonce=9999".to_string(),
            expires_at_seconds: context.expires_at_seconds,
        };

        // when
        let result = build_challenge_message(&malicious, VALID_ADDRESS, &context);

        // then
        assert!(result.is_err());
    }

    /// Given: an action field whose value contains the '=' delimiter character
    /// When: build_challenge_message runs
    /// Then: validate_signable_field rejects it before hashing, matching the documented invariant
    #[test]
    fn build_challenge_message_rejects_equals_in_action_field() {
        // given
        let context = test_context();
        let malicious = UpdateUsernameRequest {
            username: "foo=attacker_controlled".to_string(),
            expires_at_seconds: context.expires_at_seconds,
        };

        // when
        let result = build_challenge_message(&malicious, VALID_ADDRESS, &context);

        // then
        assert!(result.is_err());
    }

    #[test]
    fn build_challenge_message_orders_framing_fields_alphabetically() {
        // given
        let context = test_context();
        let request = CreateProfileRequest {
            invite_code: Some("REF123".to_string()),
            expires_at_seconds: context.expires_at_seconds,
        };

        // when
        let message = build_challenge_message(&request, VALID_ADDRESS, &context).unwrap();

        // then
        let lines: Vec<&str> = message.lines().collect();
        assert_eq!(lines[0], "btc-auth-v1");
        assert!(lines[1].starts_with("action="));
        assert!(lines[2].starts_with("address="));
        assert!(lines[3].starts_with("canister="));
        assert!(lines[4].starts_with("expires_at="));
        assert!(lines[5].starts_with("network="));
        assert!(lines[6].starts_with("nonce="));
        assert!(lines[7].starts_with("invite_code="));
    }
}
