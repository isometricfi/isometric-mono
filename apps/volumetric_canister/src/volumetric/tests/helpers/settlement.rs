use candid::Decode;

use volumetric::journaling::OperationId;
use volumetric::{
    ActiveOption, SettleExpiredOptionsResponse, SettlementReceipt, SettlementStatus,
    VolumetricError,
};

use crate::common::TestEnv;

pub fn settle_expired_options(
    env: &TestEnv,
) -> Result<SettleExpiredOptionsResponse, VolumetricError> {
    let response = env
        .pic
        .update_call(
            env.volumetric_canister,
            env.controller,
            "settle_expired_options",
            candid::encode_one(()).unwrap(),
        )
        .expect("Update call failed");

    Decode!(&response, Result<SettleExpiredOptionsResponse, VolumetricError>).unwrap()
}

pub fn settle_option_by_id(
    env: &TestEnv,
    option_id: u64,
) -> Result<SettlementReceipt, VolumetricError> {
    let response = env
        .pic
        .update_call(
            env.volumetric_canister,
            env.controller,
            "settle_option_by_id",
            candid::encode_one(option_id).unwrap(),
        )
        .expect("Update call failed");

    Decode!(&response, Result<SettlementReceipt, VolumetricError>).unwrap()
}

pub fn get_settlement_status(
    env: &TestEnv,
    operation_id: OperationId,
) -> Result<SettlementStatus, VolumetricError> {
    let response = env
        .pic
        .query_call(
            env.volumetric_canister,
            candid::Principal::anonymous(),
            "get_settlement_status",
            candid::encode_one(operation_id).unwrap(),
        )
        .expect("Query failed");

    Decode!(&response, Result<SettlementStatus, VolumetricError>).unwrap()
}

pub fn get_pending_settlements(env: &TestEnv) -> Vec<ActiveOption> {
    let response = env
        .pic
        .query_call(
            env.volumetric_canister,
            env.controller,
            "get_pending_settlements",
            candid::encode_one(()).unwrap(),
        )
        .expect("Query failed");

    Decode!(&response, Result<Vec<ActiveOption>, VolumetricError>)
        .unwrap()
        .expect("get_pending_settlements should succeed for whitelisted controller")
}

pub fn wait_for_settlement_terminal_status(
    env: &TestEnv,
    operation_id: OperationId,
    max_attempts: u8,
) -> Result<SettlementStatus, VolumetricError> {
    let mut latest_status = get_settlement_status(env, operation_id)?;

    for _attempt in 0..max_attempts {
        if matches!(
            latest_status,
            SettlementStatus::Succeeded { .. } | SettlementStatus::Failed { .. }
        ) {
            break;
        }

        env.pic.tick();
        latest_status = get_settlement_status(env, operation_id)?;
    }

    Ok(latest_status)
}

pub fn testing_set_option_expiry_seconds(
    env: &TestEnv,
    option_id: u64,
    expiry_seconds: u64,
) -> Result<ActiveOption, VolumetricError> {
    let response = env
        .pic
        .update_call(
            env.volumetric_canister,
            env.controller,
            "testing_set_option_expiry_seconds",
            candid::encode_args((option_id, expiry_seconds)).unwrap(),
        )
        .expect("Update call failed");

    Decode!(&response, Result<ActiveOption, VolumetricError>).unwrap()
}
