use candid::Principal;

use crate::auth::derive_subaccount;
use crate::storage::{emit_event, get_profile, update_profile, EventData, EventType};

pub struct UpdateProfileResult {
    pub principal: Principal,
    pub subaccount: [u8; 32],
    pub username: Option<String>,
}

pub fn update_username_use_case(
    principal: Principal,
    username: String,
) -> Option<UpdateProfileResult> {
    let mut profile = get_profile(&principal)?;
    let old_username = profile.username.clone();
    profile.username = Some(username.clone());
    update_profile(principal, profile.clone());

    emit_event(
        principal,
        EventType::UsernameUpdated,
        EventData::UsernameUpdated {
            old_username,
            new_username: username,
        },
    );

    let subaccount = derive_subaccount(principal);

    Some(UpdateProfileResult {
        principal,
        subaccount,
        username: profile.username,
    })
}
