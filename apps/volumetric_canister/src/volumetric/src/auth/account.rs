use candid::Principal;
use sha2::{Digest, Sha224};

const SUBACCOUNT_SIZE: usize = 32;

/// Derives a deterministic ICP Principal from a Bitcoin address.
/// Uses SHA-224 (28 bytes). Standard principals are 29 bytes (28-byte hash + 1-byte type suffix),
/// but we omit the type byte since this is neither a self-authenticating principal (0x02)
/// nor a canister ID (0x01). See: https://internetcomputer.org/docs/references/ic-interface-spec#principal
pub fn derive_principal(btc_address: &str) -> Principal {
    let mut hasher = Sha224::new();
    hasher.update(btc_address.as_bytes());
    let hash = hasher.finalize();
    Principal::from_slice(&hash)
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
        let addr = "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh";
        let p1 = derive_principal(addr);
        let p2 = derive_principal(addr);
        assert_eq!(p1, p2);
    }

    #[test]
    fn test_derive_principal_unique() {
        let p1 = derive_principal("bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh");
        let p2 = derive_principal("bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq");
        assert_ne!(p1, p2);
    }

    #[test]
    fn test_derive_subaccount() {
        let principal = derive_principal("bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh");
        let sub = derive_subaccount(principal);
        assert_eq!(sub.len(), SUBACCOUNT_SIZE);
        let empty_subaccount = [0u8; SUBACCOUNT_SIZE];
        assert_ne!(sub, empty_subaccount);
    }
}
