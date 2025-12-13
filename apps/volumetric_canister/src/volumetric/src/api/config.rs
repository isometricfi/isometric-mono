use ic_cdk::{query, update};

use crate::errors::VolumetricError;
use crate::guards::is_whitelisted;
use crate::storage::Config;

#[query]
pub fn get_config() -> Config {
    Config::get()
}

#[update]
pub async fn set_temp(value: String) -> Result<(), VolumetricError> {
    is_whitelisted().await?;
    Config::set_temp(value);
    Ok(())
}
