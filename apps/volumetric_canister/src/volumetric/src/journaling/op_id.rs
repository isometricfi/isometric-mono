use std::borrow::Cow;

use candid::{CandidType, Principal};
use ic_stable_structures::storable::Bound;
use ic_stable_structures::Storable;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

#[derive(
    CandidType, Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord, Hash,
)]
pub struct OperationId(pub [u8; 32]);

impl OperationId {
    pub fn from_parts(parts: &[&[u8]]) -> Self {
        let mut hasher = Sha256::new();
        for part in parts {
            let len = (part.len() as u64).to_be_bytes();
            hasher.update(len);
            hasher.update(part);
        }

        Self(hasher.finalize().into())
    }

    pub fn from_principal_bytes(
        kind: &'static str,
        principal: Principal,
        extra_parts: &[&[u8]],
    ) -> Self {
        let principal_bytes = principal.as_slice();
        let mut parts: Vec<&[u8]> = Vec::with_capacity(extra_parts.len() + 2);
        parts.push(kind.as_bytes());
        parts.push(principal_bytes);
        parts.extend_from_slice(extra_parts);
        Self::from_parts(&parts)
    }
}

impl Storable for OperationId {
    fn to_bytes(&self) -> Cow<'_, [u8]> {
        Cow::Borrowed(&self.0)
    }

    fn from_bytes(bytes: Cow<[u8]>) -> Self {
        let mut out = [0u8; 32];
        out.copy_from_slice(bytes.as_ref());
        Self(out)
    }

    fn into_bytes(self) -> Vec<u8> {
        self.0.to_vec()
    }

    const BOUND: Bound = Bound::Bounded {
        max_size: 32,
        is_fixed_size: true,
    };
}
