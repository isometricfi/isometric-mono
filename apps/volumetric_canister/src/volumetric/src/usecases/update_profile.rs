use candid::Principal;

use crate::auth::derive_subaccount;
use crate::storage::{get_profile, update_profile};

pub struct UpdateProfileResult {
    pub principal: Principal,
    pub subaccount: [u8; 32],
    pub username: Option<String>,
}

pub fn update_username(principal: Principal, username: String) -> Option<UpdateProfileResult> {
    let mut profile = get_profile(&principal)?;
    profile.username = Some(username);
    update_profile(principal, profile.clone());

    let subaccount = derive_subaccount(principal);

    Some(UpdateProfileResult {
        principal,
        subaccount,
        username: profile.username,
    })
}
