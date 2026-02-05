use candid::Principal;
use ic_cdk::api::msg_caller;

use crate::errors::VolumetricError;
use crate::guards::is_controller;
use crate::storage::{
    clear_events as storage_clear_events, get_all_events as storage_get_all_events,
    get_events_by_principal, get_events_since as storage_get_events_since, Event,
};
use crate::usecases::cleanup_old_events_use_case;

const MAX_EVENTS_LIMIT: u32 = 1000;

#[ic_cdk::query]
pub fn get_my_events(after_id: Option<u64>, limit: Option<u32>) -> Vec<Event> {
    let principal = msg_caller();
    let limit = limit.unwrap_or(100).min(MAX_EVENTS_LIMIT);
    get_events_by_principal(principal, after_id, limit)
}

#[ic_cdk::query]
pub async fn get_events_for_principal(
    principal: Principal,
    after_id: Option<u64>,
    limit: Option<u32>,
) -> Result<Vec<Event>, VolumetricError> {
    is_controller().await?;
    let limit = limit.unwrap_or(100).min(MAX_EVENTS_LIMIT);
    Ok(get_events_by_principal(principal, after_id, limit))
}

#[ic_cdk::query]
pub async fn get_events_since(
    timestamp_ns: u64,
    limit: Option<u32>,
) -> Result<Vec<Event>, VolumetricError> {
    is_controller().await?;
    let limit = limit.unwrap_or(100).min(MAX_EVENTS_LIMIT);
    Ok(storage_get_events_since(timestamp_ns, limit))
}

#[ic_cdk::query]
pub async fn get_all_events(
    after_id: Option<u64>,
    limit: Option<u32>,
) -> Result<Vec<Event>, VolumetricError> {
    is_controller().await?;
    let limit = limit.unwrap_or(100).min(MAX_EVENTS_LIMIT);
    Ok(storage_get_all_events(after_id, limit))
}

#[ic_cdk::update]
pub async fn cleanup_old_events() -> Result<u64, VolumetricError> {
    is_controller().await?;
    let result = cleanup_old_events_use_case();
    Ok(result.deleted_count)
}

#[ic_cdk::update]
pub async fn clear_all_events() -> Result<u64, VolumetricError> {
    is_controller().await?;
    Ok(storage_clear_events())
}
