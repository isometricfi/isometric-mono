use candid::{Decode, Nat};
use icrc_ledger_types::icrc1::account::Account;
use icrc_ledger_types::icrc1::transfer::TransferArg;

use volumetric::{ProfileInfo, UserBalanceInfo, VolumetricError};

use crate::common::TestEnv;

pub fn get_user_balance(env: &TestEnv, address: &str) -> Result<UserBalanceInfo, VolumetricError> {
    let response = env
        .pic
        .query_call(
            env.volumetric_canister,
            candid::Principal::anonymous(),
            "get_user_balance",
            candid::encode_one(address.to_string()).unwrap(),
        )
        .expect("Query failed");

    Decode!(&response, Result<UserBalanceInfo, VolumetricError>).unwrap()
}

pub fn mint_and_sync_balance(
    env: &TestEnv,
    profile: &ProfileInfo,
    amount: u64,
) -> Result<u64, VolumetricError> {
    mint_to_user_subaccount(env, profile, amount);
    sync_balance_from_ledger(env, &profile.address)
}

fn sync_balance_from_ledger(env: &TestEnv, address: &str) -> Result<u64, VolumetricError> {
    let response = env
        .pic
        .update_call(
            env.volumetric_canister,
            env.controller,
            "testing_sync_balance_from_ledger",
            candid::encode_one(address.to_string()).unwrap(),
        )
        .expect("Update call failed");

    Decode!(&response, Result<u64, VolumetricError>).unwrap()
}

pub fn mint_to_user_subaccount(env: &TestEnv, profile: &ProfileInfo, amount: u64) {
    let subaccount: [u8; 32] = profile
        .subaccount
        .clone()
        .try_into()
        .expect("Subaccount should be 32 bytes");

    let to = Account {
        owner: env.volumetric_canister,
        subaccount: Some(subaccount),
    };

    let args = TransferArg {
        from_subaccount: None,
        to,
        amount: Nat::from(amount),
        fee: None,
        memo: None,
        created_at_time: None,
    };

    let response = env
        .pic
        .update_call(
            env.ledger_canister,
            env.minter_canister,
            "icrc1_transfer",
            candid::encode_one(args).unwrap(),
        )
        .expect("Mint call failed");

    let result: Result<Nat, icrc_ledger_types::icrc1::transfer::TransferError> =
        Decode!(&response, Result<Nat, icrc_ledger_types::icrc1::transfer::TransferError>).unwrap();
    result.expect("Mint failed");
}
