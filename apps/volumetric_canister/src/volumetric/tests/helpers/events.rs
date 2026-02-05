use candid::{Decode, Principal};

use volumetric::{Event, VolumetricError};

use crate::common::TestEnv;

pub fn get_events_for_principal(env: &TestEnv, principal: Principal) -> Vec<Event> {
    let response = env
        .pic
        .query_call(
            env.volumetric_canister,
            env.controller,
            "get_events_for_principal",
            candid::encode_args((principal, None::<u64>, None::<u32>)).unwrap(),
        )
        .expect("Query failed");

    let result: Result<Vec<Event>, VolumetricError> =
        Decode!(&response, Result<Vec<Event>, VolumetricError>).unwrap();
    result.expect("get_events_for_principal failed")
}
