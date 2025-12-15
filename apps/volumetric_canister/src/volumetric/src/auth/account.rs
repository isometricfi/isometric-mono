use candid::Principal;
use sha2::{Digest, Sha224};

const SUBACCOUNT_SIZE: usize = 32;
const SHA224_OUTPUT_SIZE: usize = 28;
const SELF_AUTHENTICATING_PRINCIPAL_SIZE: usize = SHA224_OUTPUT_SIZE + 1;
const SELF_AUTHENTICATING_TYPE_BYTE: u8 = 0x02;

/// Derives a deterministic ICP Principal from a Bitcoin address.
/// Uses SHA-224 (28 bytes) + 0x02 type suffix to form a 29-byte self-authenticating principal.
/// See: https://internetcomputer.org/docs/references/ic-interface-spec#principal
pub fn derive_principal(btc_address: &str) -> Principal {
    let mut hasher = Sha224::new();
    hasher.update(btc_address.as_bytes());
    let hash = hasher.finalize();

    let mut principal_bytes = [0u8; SELF_AUTHENTICATING_PRINCIPAL_SIZE];
    principal_bytes[..SHA224_OUTPUT_SIZE].copy_from_slice(&hash);
    principal_bytes[SHA224_OUTPUT_SIZE] = SELF_AUTHENTICATING_TYPE_BYTE;

    Principal::from_slice(&principal_bytes)
}

pub fn derive_subaccount(principal: Principal) -> [u8; SUBACCOUNT_SIZE] {
    let zero_padding: u8 = 0;
    let mut subaccount = [zero_padding; SUBACCOUNT_SIZE];
    let principal_bytes = principal.as_slice();
    subaccount[..principal_bytes.len()].copy_from_slice(principal_bytes);
    subaccount
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_derive_principal_deterministic() {
        // given
        let addr = "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh";

        // when
        let p1 = derive_principal(addr);
        let p2 = derive_principal(addr);

        // then
        assert_eq!(p1, p2);
    }

    #[test]
    fn test_derive_principal_unique() {
        // given
        let addr1 = "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh";
        let addr2 = "bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq";

        // when
        let p1 = derive_principal(addr1);
        let p2 = derive_principal(addr2);

        // then
        assert_ne!(p1, p2);
    }

    #[test]
    fn test_derive_subaccount() {
        // given
        let principal = derive_principal("bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh");

        // when
        let sub = derive_subaccount(principal);

        // then
        assert_eq!(sub.len(), SUBACCOUNT_SIZE);
        let empty_subaccount = [0u8; SUBACCOUNT_SIZE];
        assert_ne!(sub, empty_subaccount);
    }
}
