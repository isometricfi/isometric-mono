use candid::Principal;

use crate::auth::derive_subaccount;
use crate::auth::types::WalletKey;
use crate::errors::VolumetricError;
use crate::storage::{get_principal_for_wallet, get_profile, get_referral_count};

pub struct AccountInfo {
    pub principal: Principal,
    pub subaccount: [u8; 32],
    pub address: String,
    pub username: Option<String>,
    pub invite_code: Option<String>,
    pub referral_count: u64,
}

pub fn get_account_info_use_case(address: String) -> Result<Option<AccountInfo>, VolumetricError> {
    let wallet_key = WalletKey::try_from_address(&address)?;
    let Some(principal) = get_principal_for_wallet(&wallet_key) else {
        return Ok(None);
    };
    let subaccount = derive_subaccount(principal);
    let Some(profile) = get_profile(&principal) else {
        return Ok(None);
    };

    Ok(Some(AccountInfo {
        principal,
        subaccount,
        address,
        username: profile.username,
        invite_code: profile.invite_code,
        referral_count: get_referral_count(&principal),
    }))
}
