use candid::Principal;

use crate::storage::list_all_profiles;

pub struct UserInfo {
    pub principal: Principal,
    pub address: String,
    pub username: Option<String>,
}

pub fn list_users_use_case() -> Vec<UserInfo> {
    list_all_profiles()
        .into_iter()
        .map(|(principal, profile)| UserInfo {
            principal,
            address: profile.wallet_address,
            username: profile.username,
        })
        .collect()
}
