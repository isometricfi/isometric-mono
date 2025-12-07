use ic_cdk::api::{in_replicated_execution, is_controller as api_is_controller, msg_caller};

use crate::errors::VolumetricError;
use crate::storage::WHITELIST;

pub async fn is_controller() -> Result<(), VolumetricError> {
    let caller_id = msg_caller();

    if !api_is_controller(&caller_id) {
        return Err(VolumetricError::UnauthorizedController {
            caller: caller_id.to_string(),
        });
    }

    Ok(())
}

pub async fn is_whitelisted() -> Result<(), VolumetricError> {
    let caller_id = msg_caller();

    WHITELIST.with_borrow(|whitelist| {
        if !whitelist.contains_key(&caller_id) {
            return Err(VolumetricError::UnauthorizedWhitelisted {
                caller: caller_id.to_string(),
            });
        }

        Ok(())
    })
}

pub fn no_replicated_call() -> Result<(), String> {
    if in_replicated_execution() {
        return Err("Not allowed".to_string());
    }
    Ok(())
}
