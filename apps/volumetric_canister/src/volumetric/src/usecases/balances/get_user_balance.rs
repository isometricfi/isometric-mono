use candid::Principal;

use crate::ledger;
use crate::storage::get_balance;

pub struct UserBalanceResult {
    pub total: u64,
    pub available: u64,
    pub locked: u64,
    pub max_withdraw_sats: u64,
}

pub fn get_user_balance_use_case(principal: Principal) -> UserBalanceResult {
    let balance = get_balance(&principal);
    let max_withdraw_sats = ledger::max_withdraw_ckbtc_sats_after_ledger_fees(balance.available);

    UserBalanceResult {
        total: balance.total(),
        available: balance.available,
        locked: balance.locked_as_writer,
        max_withdraw_sats,
    }
}
