#![allow(dead_code)]

use candid::Decode;

use volumetric::journaling::OperationId;
use volumetric::{VolumetricError, WalExecutionOutcome};

use crate::common::TestEnv;

pub fn get_recovery_required_wal_entries(
    env: &TestEnv,
    limit: u32,
) -> Result<Vec<OperationId>, VolumetricError> {
    let response = env
        .pic
        .query_call(
            env.volumetric_canister,
            env.controller,
            "get_recovery_required_wal_entries",
            candid::encode_one(limit).unwrap(),
        )
        .expect("Query failed");

    Decode!(&response, Result<Vec<OperationId>, VolumetricError>).unwrap()
}

pub fn recover_wal_operation(
    env: &TestEnv,
    operation_id: OperationId,
) -> Result<WalExecutionOutcome, VolumetricError> {
    let response = env
        .pic
        .update_call(
            env.volumetric_canister,
            env.controller,
            "recover_wal_operation",
            candid::encode_one(operation_id).unwrap(),
        )
        .expect("Update call failed");

    Decode!(&response, Result<WalExecutionOutcome, VolumetricError>).unwrap()
}
