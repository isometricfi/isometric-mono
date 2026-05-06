use candid::Principal;
use ic_cdk::{query, update};

use crate::errors::VolumetricError;
use crate::guards::{is_controller, is_whitelisted, no_replicated_call};
use crate::usecases;

const HELLO_RESPONSE: &str = "hello";

#[query(guard = "no_replicated_call")]
pub fn hello() -> Result<String, VolumetricError> {
    is_whitelisted()?;
    Ok(HELLO_RESPONSE.to_string())
}

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
    is_whitelisted()?;
    Ok(usecases::list_whitelisted_use_case())
}
