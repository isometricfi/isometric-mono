use candid::{Decode, Principal};

use volumetric::Event;

use crate::common::TestEnv;

pub fn get_events_for_principal(env: &TestEnv, principal: Principal) -> Vec<Event> {
    let response = env
        .pic
        .query_call(
            env.volumetric_canister,
            candid::Principal::anonymous(),
            "get_events_for_principal",
            candid::encode_args((principal, None::<u64>, None::<u32>)).unwrap(),
        )
        .expect("Query failed");

    Decode!(&response, Vec<Event>).unwrap()
}
