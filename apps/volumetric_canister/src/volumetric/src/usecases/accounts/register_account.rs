use candid::Principal;

use crate::auth::types::WalletKey;
use crate::auth::{derive_principal, derive_subaccount};
use crate::ic;
use crate::storage::{create_profile, emit_event, register_wallet, EventData, EventType, Profile};

pub struct RegisterAccountParams {
    pub wallet_address: String,
}

pub struct RegisterAccountResult {
    pub principal: Principal,
    pub subaccount: [u8; 32],
}

pub fn register_account_use_case(params: RegisterAccountParams) -> RegisterAccountResult {
    let principal = derive_principal(&params.wallet_address);
    let subaccount = derive_subaccount(principal);
    let wallet_key = WalletKey::from_address(&params.wallet_address);

    let profile = Profile {
        wallet_address: params.wallet_address.clone(),
        username: None,
        created_at: ic::time(),
    };

    create_profile(principal, profile);
    register_wallet(wallet_key, principal);

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
