use candid::Principal;
use ic_cdk::{query, update};

use crate::errors::VolumetricError;
use crate::guards::is_controller;
use crate::storage::WHITELIST;

#[update]
pub async fn add_whitelisted(principal: Principal) -> Result<(), VolumetricError> {
    is_controller().await?;
    WHITELIST.with_borrow_mut(|whitelist| whitelist.insert(principal, true));
    Ok(())
}

#[update]
pub async fn remove_whitelisted(principal: Principal) -> Result<(), VolumetricError> {
    is_controller().await?;
    WHITELIST.with_borrow_mut(|whitelist| whitelist.remove(&principal));
    Ok(())
}

#[query]
pub fn list_whitelisted() -> Vec<Principal> {
    WHITELIST.with_borrow(|whitelist| whitelist.iter().map(|entry| entry.key().clone()).collect())
}
