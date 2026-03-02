use candid::Principal;

use crate::auth::types::WalletKey;
use crate::auth::{derive_principal, derive_subaccount};
use crate::ic;
use crate::storage::{
    create_profile, emit_event, get_or_create_invite_code, link_referrer_once, register_wallet,
    EventData, EventType, Profile,
};

pub struct RegisterAccountParams {
    pub wallet_address: String,
    pub invite_code: Option<String>,
}

pub struct RegisterAccountResult {
    pub principal: Principal,
    pub subaccount: [u8; 32],
}

pub fn register_account_use_case(params: RegisterAccountParams) -> RegisterAccountResult {
    let principal = derive_principal(&params.wallet_address);
    let subaccount = derive_subaccount(principal);
    let wallet_key = WalletKey::from_address(&params.wallet_address);

    let _ = get_or_create_invite_code(principal, None);

    let profile = Profile {
        wallet_address: params.wallet_address.clone(),
        username: None,
        created_at: ic::time(),
    };

    create_profile(principal, profile);
    register_wallet(wallet_key, principal);
    let referred_by = link_referrer_once(principal, params.invite_code.clone());
    if params.invite_code.is_some() && referred_by.is_none() {
        ic::log("Ignoring invalid, self, or duplicate invite code during registration");
    }

    emit_event(
        principal,
        EventType::AccountCreated,
        EventData::AccountCreated {
            wallet_address: params.wallet_address,
        },
    );

    RegisterAccountResult {
        principal,
        subaccount,
    }
}
