use std::borrow::Cow;

use candid::CandidType;
use ic_stable_structures::storable::Bound;
use ic_stable_structures::Storable;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

const WALLET_KEY_SIZE: usize = 64;

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub struct WalletKey([u8; WALLET_KEY_SIZE]);

impl WalletKey {
    pub fn from_address(address: &str) -> Self {
        let zero_padding: u8 = 0;
        let mut bytes = [zero_padding; WALLET_KEY_SIZE];
        let address_bytes = address.as_bytes();
        if address_bytes.len() <= WALLET_KEY_SIZE {
            let len = address_bytes.len();
            bytes[..len].copy_from_slice(address_bytes);
            return Self(bytes);
        }

        let primary_hash = Sha256::digest(address_bytes);
        let mut secondary_hasher = Sha256::new();
        secondary_hasher.update(b"wallet-key-v2");
        secondary_hasher.update(address_bytes);
        let secondary_hash = secondary_hasher.finalize();

        bytes[..32].copy_from_slice(&primary_hash);
        bytes[32..].copy_from_slice(&secondary_hash);
        Self(bytes)
    }

    pub fn to_address(&self) -> String {
        let first_null = self.0.iter().position(|&b| b == 0);
        let end = first_null.unwrap_or(WALLET_KEY_SIZE);
        String::from_utf8_lossy(&self.0[..end]).to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn legacy_wallet_key_bytes(address: &str) -> [u8; WALLET_KEY_SIZE] {
        let mut bytes = [0u8; WALLET_KEY_SIZE];
        let address_bytes = address.as_bytes();
        let len = address_bytes.len().min(WALLET_KEY_SIZE);
        bytes[..len].copy_from_slice(&address_bytes[..len]);
        bytes
    }

    #[test]
    fn test_wallet_key_short_addresses_keep_legacy_encoding() {
        // given
        let address = "tb1qexamplelegacykey";

        // when
        let key = WalletKey::from_address(address);

        // then
        assert_eq!(key.0, legacy_wallet_key_bytes(address));
    }

    #[test]
    fn test_wallet_key_long_addresses_with_same_prefix_do_not_collide() {
        // given
        let prefix = "a".repeat(WALLET_KEY_SIZE);
        let address_one = format!("{}1111", prefix);
        let address_two = format!("{}2222", prefix);

        // when
        let key_one = WalletKey::from_address(&address_one);
        let key_two = WalletKey::from_address(&address_two);

        // then
        assert_ne!(key_one, key_two);
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
pub struct CreateProfileRequest {}

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
