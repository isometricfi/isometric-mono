use candid::Principal;

use crate::errors::VolumetricError;
use crate::storage::get_balance;

pub struct UserBalanceResult {
    pub total: u64,
    pub available: u64,
    pub locked: u64,
}

pub fn get_user_balance_use_case(
    principal: Principal,
) -> Result<UserBalanceResult, VolumetricError> {
    let balance = get_balance(&principal);

    Ok(UserBalanceResult {
        total: balance.total(),
        available: balance.available,
        locked: balance.locked_as_writer,
    })
}
