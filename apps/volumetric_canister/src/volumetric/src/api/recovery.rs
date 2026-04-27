use crate::errors::VolumetricError;
use crate::guards::{is_controller, no_replicated_call};
use crate::journaling::{
    execute_wal_entry_now, list_entries_by_status, OperationId, WalExecutionOutcome, WalStatus,
};

const MIN_WAL_QUERY_LIMIT_ENTRIES: u32 = 0;
const MAX_WAL_QUERY_LIMIT_ENTRIES: u32 = 1_000;

#[ic_cdk::query(guard = "no_replicated_call")]
pub fn get_recovery_required_wal_entries(limit: u32) -> Result<Vec<OperationId>, VolumetricError> {
    is_controller()?;

    let recovery_limit = normalize_wal_query_limit_entries(limit);
    if recovery_limit == 0 {
        return Ok(Vec::new());
    }

    let operation_ids = list_entries_by_status(WalStatus::RecoveryRequired, recovery_limit)
        .into_iter()
        .map(|entry| entry.id)
        .collect();
    Ok(operation_ids)
}

#[ic_cdk::update]
pub async fn recover_wal_operation(
    operation_id: OperationId,
) -> Result<WalExecutionOutcome, VolumetricError> {
    is_controller()?;
    let outcome = execute_wal_entry_now(operation_id).await;
    logging::log!(
        "recover_wal_operation operation_id={:?} outcome={:?}",
        operation_id,
        outcome
    );
    Ok(outcome)
}

fn normalize_wal_query_limit_entries(limit_requested: u32) -> usize {
    let bounded_limit =
        limit_requested.clamp(MIN_WAL_QUERY_LIMIT_ENTRIES, MAX_WAL_QUERY_LIMIT_ENTRIES);

    usize::try_from(bounded_limit).unwrap_or(usize::MAX)
}
