use std::borrow::Cow;

use candid::CandidType;
use ic_stable_structures::storable::Bound;
use ic_stable_structures::Storable;
use serde::{Deserialize, Serialize};

use crate::errors::{error_codes, VolumetricError};

const WALLET_KEY_SIZE: usize = 64;
const MAX_WALLET_ADDRESS_BYTES: usize = WALLET_KEY_SIZE;

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

pub trait SignableAction {
    fn signing_message(&self, address: &str, context: &ChallengeContext) -> String;
}

#[derive(Debug, Clone)]
pub struct ChallengeContext {
    pub canister_id: String,
    pub network: &'static str,
    pub nonce: u64,
}

#[derive(Debug, Clone, CandidType, Serialize, Deserialize)]
pub struct CreateProfileRequest {
    pub invite_code: Option<String>,
}

impl SignableAction for CreateProfileRequest {
    fn signing_message(&self, address: &str, context: &ChallengeContext) -> String {
        format!(
            "Sign up for Volumetric\nAddress: {}\nCanister: {}\nNetwork: {}\nNonce: {}",
            address, context.canister_id, context.network, context.nonce
        )
    }
}

#[derive(Debug, Clone, CandidType, Serialize, Deserialize)]
pub struct UpdateUsernameRequest {
    pub username: String,
}

impl SignableAction for UpdateUsernameRequest {
    fn signing_message(&self, address: &str, context: &ChallengeContext) -> String {
        format!(
            "Update username to: {}\nAddress: {}\nCanister: {}\nNetwork: {}\nNonce: {}",
            self.username, address, context.canister_id, context.network, context.nonce
        )
    }
}

#[derive(Debug, Clone, CandidType, Serialize, Deserialize)]
pub struct WithdrawCkbtcRequest {
    pub btc_address: String,
    pub amount: u64,
}

impl SignableAction for WithdrawCkbtcRequest {
    fn signing_message(&self, address: &str, context: &ChallengeContext) -> String {
        format!(
            "Withdraw {} sats to {}\nAddress: {}\nCanister: {}\nNetwork: {}\nNonce: {}",
            self.amount,
            self.btc_address,
            address,
            context.canister_id,
            context.network,
            context.nonce
        )
    }
}

#[cfg(test)]
mod tests {
    use super::WalletKey;

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
        // given
        const VALID_ADDRESS: &str = "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh";

        // when
        let first_wallet_key = WalletKey::try_from_address(VALID_ADDRESS).unwrap();
        let second_wallet_key = WalletKey::try_from_address(VALID_ADDRESS).unwrap();

        // then
        assert_eq!(first_wallet_key, second_wallet_key);
    }

    #[test]
    fn wallet_key_try_from_address_should_trim_input() {
        // given
        const VALID_ADDRESS_WITH_SPACES: &str = "  bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh  ";
        const VALID_ADDRESS: &str = "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh";

        // when
        let first_wallet_key = WalletKey::try_from_address(VALID_ADDRESS_WITH_SPACES).unwrap();
        let second_wallet_key = WalletKey::try_from_address(VALID_ADDRESS).unwrap();

        // then
        assert_eq!(first_wallet_key, second_wallet_key);
    }
}
