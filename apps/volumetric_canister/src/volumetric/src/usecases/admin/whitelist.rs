use candid::Principal;

use crate::errors::{error_codes, VolumetricError};
use crate::storage::WHITELIST;

pub fn add_whitelisted_use_case(principal: Principal) -> Result<(), VolumetricError> {
    if principal == Principal::anonymous() {
        return Err(VolumetricError::from_def(
            error_codes::UNAUTHORIZED_WHITELISTED,
            Some("cannot whitelist anonymous principal"),
            Some(&principal.to_string()),
        ));
    }

    WHITELIST.with_borrow_mut(|whitelist| whitelist.insert(principal, true));
    Ok(())
}

pub fn remove_whitelisted_use_case(principal: Principal) {
    WHITELIST.with_borrow_mut(|whitelist| whitelist.remove(&principal));
}

pub fn list_whitelisted_use_case() -> Vec<Principal> {
    WHITELIST.with_borrow(|whitelist| whitelist.iter().map(|entry| *entry.key()).collect())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_principal() -> Principal {
        Principal::from_slice(&[2; 29])
    }

    #[test]
    fn test_add_whitelisted_rejects_anonymous_principal() {
        // given
        let anonymous_principal = Principal::anonymous();

        // when
        let result = add_whitelisted_use_case(anonymous_principal);

        // then
        assert!(result.is_err());
        let error = result.unwrap_err();
        assert_eq!(error.code, error_codes::UNAUTHORIZED_WHITELISTED.code);
    }

    #[test]
    fn test_add_whitelisted_adds_non_anonymous_principal() {
        // given
        let principal = test_principal();
        remove_whitelisted_use_case(principal);

        // when
        let result = add_whitelisted_use_case(principal);

        // then
        assert!(result.is_ok());
        let whitelist = list_whitelisted_use_case();
        assert!(whitelist.contains(&principal));

        remove_whitelisted_use_case(principal);
    }
}
