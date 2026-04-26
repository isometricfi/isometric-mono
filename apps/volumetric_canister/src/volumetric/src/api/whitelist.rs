use candid::Principal;
use ic_cdk::{query, update};

use crate::errors::VolumetricError;
use crate::guards::{is_controller, no_replicated_call};
use crate::usecases;

#[update]
pub fn add_whitelisted(principal: Principal) -> Result<(), VolumetricError> {
    is_controller()?;
    usecases::add_whitelisted_use_case(principal)
}

#[update]
pub fn remove_whitelisted(principal: Principal) -> Result<(), VolumetricError> {
    is_controller()?;
    usecases::remove_whitelisted_use_case(principal);
    Ok(())
}

#[query(guard = "no_replicated_call")]
pub fn list_whitelisted() -> Result<Vec<Principal>, VolumetricError> {
    is_controller()?;
    Ok(usecases::list_whitelisted_use_case())
}
