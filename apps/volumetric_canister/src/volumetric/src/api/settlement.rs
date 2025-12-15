use candid::CandidType;
use serde::{Deserialize, Serialize};

use crate::errors::VolumetricError;
use crate::guards::is_whitelisted;
use crate::storage::{
    get_active_option, list_expired_active_options, update_active_option, ActiveOption,
    ActiveOptionStatus,
};
use crate::usecases;

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct SettlementResult {
    pub option_id: u64,
    pub settlement_price_cents: u64,
    pub payout_to_buyer: u64,
    pub payout_to_writer: u64,
    pub status: ActiveOptionStatus,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct SettleExpiredOptionsResponse {
    pub settled: Vec<SettlementResult>,
    pub errors: Vec<String>,
}

impl From<usecases::SettlementResult> for SettlementResult {
    fn from(r: usecases::SettlementResult) -> Self {
        Self {
            option_id: r.option_id,
            settlement_price_cents: r.settlement_price_cents,
            payout_to_buyer: r.payout_to_buyer,
            payout_to_writer: r.payout_to_writer,
            status: r.status,
        }
    }
}

impl From<usecases::SettleExpiredOptionsResult> for SettleExpiredOptionsResponse {
    fn from(r: usecases::SettleExpiredOptionsResult) -> Self {
        Self {
            settled: r.settled.into_iter().map(Into::into).collect(),
            errors: r.errors,
        }
    }
}

#[ic_cdk::update]
pub async fn settle_expired_options() -> Result<SettleExpiredOptionsResponse, VolumetricError> {
    is_whitelisted().await?;
    let result = usecases::settle_expired_options().await;
    Ok(result.into())
}

#[ic_cdk::update]
pub async fn settle_option_by_id(option_id: u64) -> Result<SettlementResult, VolumetricError> {
    is_whitelisted().await?;
    let result = usecases::settle_option_by_id(option_id).await?;
    Ok(result.into())
}

#[ic_cdk::query]
pub fn get_pending_settlements() -> Vec<ActiveOption> {
    let now = ic_cdk::api::time();
    list_expired_active_options(now)
}

pub fn setup_settlement_timer() {
    usecases::setup_settlement_timer();
}

#[ic_cdk::update]
pub async fn testing_expire_option(option_id: u64) -> Result<ActiveOption, VolumetricError> {
    is_whitelisted().await?;

    let mut option =
        get_active_option(option_id).ok_or_else(|| VolumetricError::option_not_found(option_id))?;

    if option.status != ActiveOptionStatus::Active {
        return Err(VolumetricError::option_already_settled());
    }

    option.expiry = 0;
    update_active_option(option.clone());

    Ok(option)
}

#[ic_cdk::update]
pub async fn testing_set_option_expiry(
    option_id: u64,
    expiry_ns: u64,
) -> Result<ActiveOption, VolumetricError> {
    is_whitelisted().await?;

    let mut option =
        get_active_option(option_id).ok_or_else(|| VolumetricError::option_not_found(option_id))?;

    if option.status != ActiveOptionStatus::Active {
        return Err(VolumetricError::option_already_settled());
    }

    option.expiry = expiry_ns;
    update_active_option(option.clone());

    Ok(option)
}

#[ic_cdk::update]
pub async fn testing_force_settle(option_id: u64) -> Result<SettlementResult, VolumetricError> {
    is_whitelisted().await?;
    let result = usecases::testing_force_settle_option(option_id).await?;
    Ok(result.into())
}
