use std::borrow::Cow;

use candid::CandidType;
use ic_stable_structures::storable::Bound;
use ic_stable_structures::Storable;
use serde::{Deserialize, Serialize};

const WALLET_KEY_SIZE: usize = 64;

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub struct WalletKey([u8; WALLET_KEY_SIZE]);

impl WalletKey {
    pub fn from_address(address: &str) -> Self {
        let zero_padding: u8 = 0;
        let mut bytes = [zero_padding; WALLET_KEY_SIZE];
        let address_bytes = address.as_bytes();
        let len = address_bytes.len().min(WALLET_KEY_SIZE);
        bytes[..len].copy_from_slice(&address_bytes[..len]);
        Self(bytes)
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
    pub canister_id_hash: String,
    pub network: &'static str,
    pub nonce: u64,
}

#[derive(Debug, Clone, CandidType, Serialize, Deserialize)]
pub struct CreateProfileRequest {}

impl SignableAction for CreateProfileRequest {
    fn signing_message(&self, address: &str, context: &ChallengeContext) -> String {
        format!(
            "Sign up for Volumetric\nAddress: {}\nCanister: {}\nNetwork: {}\nNonce: {}",
            address, context.canister_id_hash, context.network, context.nonce
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
            self.username, address, context.canister_id_hash, context.network, context.nonce
        )
    }
}
