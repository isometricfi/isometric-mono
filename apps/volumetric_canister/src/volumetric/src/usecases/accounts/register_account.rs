use candid::Principal;

use crate::auth::types::WalletKey;
use crate::auth::{derive_principal, derive_subaccount};
use crate::errors::VolumetricError;
use crate::storage::{
    create_profile, emit_event, get_or_create_invite_code, register_wallet,
    validate_invite_code_for_principal, EventData, EventType, Profile,
};
use crate::time::current_time_seconds;

pub struct RegisterAccountParams {
    pub wallet_address: String,
    pub invite_code: Option<String>,
}

pub struct RegisterAccountResult {
    pub principal: Principal,
    pub subaccount: [u8; 32],
    pub invite_code: Option<String>,
}

pub fn register_account_use_case(
    params: RegisterAccountParams,
) -> Result<RegisterAccountResult, VolumetricError> {
    let principal = derive_principal(&params.wallet_address);
    let subaccount = derive_subaccount(principal);
    let wallet_key = WalletKey::try_from_address(&params.wallet_address)?;
    let referred_by = validate_invite_code_for_principal(params.invite_code.as_deref(), principal)?;

    let profile = Profile {
        wallet_address: params.wallet_address.clone(),
        username: None,
        created_at_seconds: current_time_seconds(),
        invite_code: None,
        referred_by,
    };

    create_profile(principal, profile);
    register_wallet(wallet_key, principal);
    let invite_code = get_or_create_invite_code(principal);

    emit_event(
        principal,
        EventType::AccountCreated,
        EventData::AccountCreated {
            wallet_address: params.wallet_address,
        },
    );

    logging::log!("account registered principal={}", principal);

    Ok(RegisterAccountResult {
        principal,
        subaccount,
        invite_code,
    })
}
