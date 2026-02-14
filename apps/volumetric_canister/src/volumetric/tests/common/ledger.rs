use candid::Nat;
use icrc_ledger_types::icrc1::account::Account;
use icrc_ledger_types::icrc1::transfer::{TransferArg, TransferError};

use super::TestEnv;

#[allow(dead_code)]
pub fn balance_of(env: &TestEnv, account: Account) -> u64 {
    let result: Nat = env.query(env.ledger_canister, "icrc1_balance_of", account);
    result.0.try_into().unwrap_or(0)
}

#[allow(dead_code)]
pub fn mint(env: &TestEnv, to: Account, amount: u64) -> Result<u64, TransferError> {
    transfer(env, env.minter_canister, to, amount, None)
}

#[allow(dead_code)]
pub fn transfer(
    env: &TestEnv,
    from: candid::Principal,
    to: Account,
    amount: u64,
    from_subaccount: Option<[u8; 32]>,
) -> Result<u64, TransferError> {
    let args = TransferArg {
        from_subaccount,
        to,
        amount: Nat::from(amount),
        fee: None,
        memo: None,
        created_at_time: None,
    };

    let result: Result<Nat, TransferError> = env
        .update(env.ledger_canister, from, "icrc1_transfer", args)
        .map_err(|e| TransferError::GenericError {
            error_code: Nat::from(1u64),
            message: e,
        })?;

    match result {
        Ok(block_index) => Ok(block_index.0.try_into().unwrap_or(0)),
        Err(e) => Err(e),
    }
}
