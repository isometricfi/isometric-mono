use candid::{Decode, Nat, Principal};
use icrc_ledger_types::icrc1::account::Account;

use volumetric::{FeatureFlags, FeeConfig, VolumetricError};

use crate::common::TestEnv;

pub fn set_feature_flags(env: &TestEnv, flags: FeatureFlags) {
    let response = env
        .pic
        .update_call(
            env.volumetric_canister,
            env.controller,
            "set_feature_flags_config",
            candid::encode_one(flags).unwrap(),
        )
        .expect("Feature flags call failed");

    let result: Result<(), VolumetricError> =
        Decode!(&response, Result<(), VolumetricError>).unwrap();
    result.expect("Failed to set feature flags");
}

pub fn whitelist_controller(env: &TestEnv) {
    let response = env
        .pic
        .update_call(
            env.volumetric_canister,
            env.controller,
            "add_whitelisted",
            candid::encode_one(env.controller).unwrap(),
        )
        .expect("Whitelist call failed");

    let result: Result<(), VolumetricError> =
        Decode!(&response, Result<(), VolumetricError>).unwrap();
    result.expect("Failed to whitelist controller");
}

pub fn configure_test_ledger(env: &TestEnv) {
    let response = env
        .pic
        .update_call(
            env.volumetric_canister,
            env.controller,
            "testing_set_ckbtc_ledger",
            candid::encode_one(env.ledger_canister).unwrap(),
        )
        .expect("Set ledger call failed");

    let result: Result<(), VolumetricError> =
        Decode!(&response, Result<(), VolumetricError>).unwrap();
    result.expect("Failed to set test ledger");
}

pub fn set_oracle_price(env: &TestEnv, price_cents: u64) {
    let response = env
        .pic
        .update_call(
            env.volumetric_canister,
            env.controller,
            "testing_set_oracle_price_cents",
            candid::encode_one(price_cents).unwrap(),
        )
        .expect("Set oracle price call failed");

    let result: Result<(), VolumetricError> =
        Decode!(&response, Result<(), VolumetricError>).unwrap();
    result.expect("Failed to set oracle price");
}

pub fn get_fee_config(env: &TestEnv) -> FeeConfig {
    let response = env
        .pic
        .query_call(
            env.volumetric_canister,
            env.controller,
            "get_fee_config",
            candid::encode_one(()).unwrap(),
        )
        .expect("Get fee config call failed");

    let result: Result<FeeConfig, VolumetricError> =
        Decode!(&response, Result<FeeConfig, VolumetricError>).unwrap();
    result.expect("Failed to get fee config")
}

pub fn get_fee_recipient_ledger_balance(env: &TestEnv) -> u64 {
    let fee_config = get_fee_config(env);
    get_principal_ledger_balance(env, fee_config.fee_recipient)
}

pub fn get_principal_ledger_balance(env: &TestEnv, principal: Principal) -> u64 {
    get_subaccount_ledger_balance(env, principal, None)
}

pub fn get_subaccount_ledger_balance(
    env: &TestEnv,
    owner: Principal,
    subaccount: Option<[u8; 32]>,
) -> u64 {
    let account = Account { owner, subaccount };

    let response = env
        .pic
        .query_call(
            env.ledger_canister,
            env.controller,
            "icrc1_balance_of",
            candid::encode_one(account).unwrap(),
        )
        .expect("Balance query failed");

    let balance: Nat = Decode!(&response, Nat).expect("Failed to decode balance");
    balance.0.try_into().unwrap_or(0)
}

pub fn get_platform_fees_collected_total(env: &TestEnv) -> u64 {
    let response = env
        .pic
        .query_call(
            env.volumetric_canister,
            env.controller,
            "get_platform_fees_collected_total",
            candid::encode_one(()).unwrap(),
        )
        .expect("Get platform fees collected total call failed");

    let result: Result<u64, VolumetricError> =
        Decode!(&response, Result<u64, VolumetricError>).unwrap();
    result.expect("Failed to get platform fees collected total")
}
