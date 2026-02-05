use candid::{decode_one, CandidType, Principal};
use serde::de::DeserializeOwned;

use crate::common::{create_test_env, fixtures, TestEnv};
use crate::helpers::{whitelist_controller, whitelist_principal};
use volumetric::errors::error_codes;
use volumetric::{ClearStorageResponse, SettlementResult, TradingLimits, VolumetricError};

fn expect_admin_only_call<T>(env: &TestEnv, caller: Principal, method: &str, arg: impl CandidType)
where
    T: DeserializeOwned + CandidType,
{
    let response = env
        .pic
        .update_call(
            env.volumetric_canister,
            caller,
            method,
            candid::encode_one(arg).unwrap(),
        )
        .expect("Call should return candid payload");

    let result: Result<T, VolumetricError> =
        decode_one(&response).expect("Failed to decode VolumetricError response");
    let err = match result {
        Ok(_) => panic!("Expected unauthorized controller error"),
        Err(err) => err,
    };
    assert_eq!(
        err.code,
        error_codes::UNAUTHORIZED_CONTROLLER.code,
        "expected UNAUTHORIZED_CONTROLLER for {method}"
    );
}

fn expect_admin_only_query<T>(env: &TestEnv, caller: Principal, method: &str, encoded_arg: Vec<u8>)
where
    T: DeserializeOwned + CandidType,
{
    let response = env
        .pic
        .query_call(env.volumetric_canister, caller, method, encoded_arg)
        .expect("Query should return candid payload");

    let result: Result<T, VolumetricError> =
        decode_one(&response).expect("Failed to decode VolumetricError response");
    let err = match result {
        Ok(_) => panic!("Expected unauthorized controller error"),
        Err(err) => err,
    };
    assert_eq!(
        err.code,
        error_codes::UNAUTHORIZED_CONTROLLER.code,
        "expected UNAUTHORIZED_CONTROLLER for {method}"
    );
}

#[test]
fn test_admin_endpoints_require_controller_even_for_whitelisted_users() {
    // given
    let env = create_test_env();
    whitelist_controller(&env);
    let attacker = fixtures::test_principal(42);
    whitelist_principal(&env, attacker);

    // when/then
    expect_admin_only_call::<()>(&env, attacker, "set_oracle_price_config", 42_000u64);
    expect_admin_only_call::<()>(
        &env,
        attacker,
        "set_trading_limits_config",
        TradingLimits::default(),
    );
    expect_admin_only_call::<()>(
        &env,
        attacker,
        "testing_set_ckbtc_ledger",
        env.ledger_canister,
    );
    expect_admin_only_call::<u64>(
        &env,
        attacker,
        "testing_sync_balance_from_ledger",
        "tb1qfakeaddress000000000000000000000000000000000000000000".to_string(),
    );
    expect_admin_only_call::<SettlementResult>(&env, attacker, "testing_force_settle", 1u64);
    expect_admin_only_call::<ClearStorageResponse>(
        &env,
        attacker,
        "testing_clear_offers_and_options",
        (),
    );
    expect_admin_only_call::<()>(&env, attacker, "settle_expired_options", ());
    expect_admin_only_call::<SettlementResult>(&env, attacker, "settle_option_by_id", 1u64);
    expect_admin_only_query::<Vec<volumetric::UserInfo>>(
        &env,
        attacker,
        "list_users",
        candid::encode_one(()).unwrap(),
    );
    expect_admin_only_query::<Vec<volumetric::Event>>(
        &env,
        attacker,
        "get_events_for_principal",
        candid::encode_args((attacker, None::<u64>, None::<u32>)).unwrap(),
    );
    expect_admin_only_query::<Vec<volumetric::Event>>(
        &env,
        attacker,
        "get_events_since",
        candid::encode_args((0u64, None::<u32>)).unwrap(),
    );
    expect_admin_only_query::<Vec<volumetric::Event>>(
        &env,
        attacker,
        "get_all_events",
        candid::encode_args((None::<u64>, None::<u32>)).unwrap(),
    );
}
