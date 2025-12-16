use candid::Principal;

use crate::auth::derive_subaccount;
use crate::auth::types::WalletKey;
use crate::storage::{get_principal_for_wallet, get_profile};

pub struct AccountInfo {
    pub principal: Principal,
    pub subaccount: [u8; 32],
    pub address: String,
    pub username: Option<String>,
}

pub fn get_account_info_use_case(address: String) -> Option<AccountInfo> {
    let wallet_key = WalletKey::from_address(&address);
    let principal = get_principal_for_wallet(&wallet_key)?;
    let subaccount = derive_subaccount(principal);
    let profile = get_profile(&principal)?;

    Some(AccountInfo {
        principal,
        subaccount,
        address,
        username: profile.username,
    })
}
