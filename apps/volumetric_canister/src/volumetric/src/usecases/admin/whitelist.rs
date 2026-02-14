use candid::Principal;

use crate::storage::WHITELIST;

pub fn add_whitelisted_use_case(principal: Principal) {
    WHITELIST.with_borrow_mut(|whitelist| whitelist.insert(principal, true));
}

pub fn remove_whitelisted_use_case(principal: Principal) {
    WHITELIST.with_borrow_mut(|whitelist| whitelist.remove(&principal));
}

pub fn list_whitelisted_use_case() -> Vec<Principal> {
    WHITELIST.with_borrow(|whitelist| whitelist.iter().map(|entry| *entry.key()).collect())
}
