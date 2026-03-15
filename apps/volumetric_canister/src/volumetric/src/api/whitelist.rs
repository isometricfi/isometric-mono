use candid::Principal;
use ic_cdk::{query, update};

use crate::errors::VolumetricError;
use crate::guards::is_controller;
use crate::usecases;

#[update]
pub fn add_whitelisted(principal: Principal) -> Result<(), VolumetricError> {
    is_controller()?;
    usecases::add_whitelisted_use_case(principal);
    Ok(())
}

#[update]
pub fn remove_whitelisted(principal: Principal) -> Result<(), VolumetricError> {
    is_controller()?;
    usecases::remove_whitelisted_use_case(principal);
    Ok(())
}

#[query]
pub fn list_whitelisted() -> Vec<Principal> {
    usecases::list_whitelisted_use_case()
}
