use candid::Principal;

use crate::auth::types::WalletKey;
use crate::auth::{derive_principal, derive_subaccount};
use crate::storage::{create_profile, register_wallet, Profile};

pub struct RegisterAccountParams {
    pub wallet_address: String,
}

pub struct RegisterAccountResult {
    pub principal: Principal,
    pub subaccount: [u8; 32],
}

pub fn register_account(params: RegisterAccountParams) -> RegisterAccountResult {
    let principal = derive_principal(&params.wallet_address);
    let subaccount = derive_subaccount(principal);
    let wallet_key = WalletKey::from_address(&params.wallet_address);

    let profile = Profile {
        wallet_address: params.wallet_address,
        username: None,
        created_at: ic_cdk::api::time(),
    };

    create_profile(principal, profile);
    register_wallet(wallet_key, principal);

    RegisterAccountResult {
        principal,
        subaccount,
    }
}
