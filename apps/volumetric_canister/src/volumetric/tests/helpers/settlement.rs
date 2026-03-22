use candid::Decode;

use volumetric::journaling::OperationId;
use volumetric::{
    ActiveOption, SettleExpiredOptionsResponse, SettlementReceipt, SettlementStatus,
    VolumetricError,
};

use crate::common::TestEnv;

#[allow(dead_code)]
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

#[allow(dead_code)]
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

#[allow(dead_code)]
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
            candid::Principal::anonymous(),
            "get_pending_settlements",
            candid::encode_one(()).unwrap(),
        )
        .expect("Query failed");

    Decode!(&response, Vec<ActiveOption>).unwrap()
}

#[allow(dead_code)]
pub fn testing_set_option_expiry(
    env: &TestEnv,
    option_id: u64,
    expiry_ns: u64,
) -> Result<ActiveOption, VolumetricError> {
    let response = env
        .pic
        .update_call(
            env.volumetric_canister,
            env.controller,
            "testing_set_option_expiry",
            candid::encode_args((option_id, expiry_ns)).unwrap(),
        )
        .expect("Update call failed");

    Decode!(&response, Result<ActiveOption, VolumetricError>).unwrap()
}
