use candid::CandidType;
use serde::{Deserialize, Serialize};

use crate::auth::types::WalletKey;
use crate::errors::VolumetricError;
use crate::guards::is_whitelisted;
use crate::storage::{get_active_option, get_principal_for_wallet, ActiveOption};
use crate::usecases;

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct AcceptOfferItem {
    pub offer_id: u64,
    pub quantity: u64,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct AcceptOffersRequest {
    pub wallet_address: String,
    pub items: Vec<AcceptOfferItem>,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct AcceptOffersResponse {
    pub active_options: Vec<ActiveOption>,
    pub fill_group_id: u64,
}

#[ic_cdk::update]
pub async fn accept_offers(
    req: AcceptOffersRequest,
) -> Result<AcceptOffersResponse, VolumetricError> {
    is_whitelisted().await?;

    let wallet_key = WalletKey::from_address(&req.wallet_address);
    let buyer_principal =
        get_principal_for_wallet(&wallet_key).ok_or_else(VolumetricError::profile_not_found)?;

    let items: Vec<usecases::AcceptOfferItem> = req
        .items
        .into_iter()
        .map(|i| usecases::AcceptOfferItem {
            offer_id: i.offer_id,
            quantity: i.quantity,
        })
        .collect();

    let result = usecases::accept_offers_use_case(buyer_principal, items).await?;

    Ok(AcceptOffersResponse {
        active_options: result.active_options,
        fill_group_id: result.fill_group_id,
    })
}

#[ic_cdk::query]
pub fn get_my_options(wallet_address: String) -> Result<Vec<ActiveOption>, VolumetricError> {
    let wallet_key = WalletKey::from_address(&wallet_address);
    let principal =
        get_principal_for_wallet(&wallet_key).ok_or_else(VolumetricError::profile_not_found)?;

    Ok(usecases::get_my_options_use_case(principal))
}

#[ic_cdk::query]
pub fn get_my_written_options(
    wallet_address: String,
) -> Result<Vec<ActiveOption>, VolumetricError> {
    let wallet_key = WalletKey::from_address(&wallet_address);
    let principal =
        get_principal_for_wallet(&wallet_key).ok_or_else(VolumetricError::profile_not_found)?;

    Ok(usecases::get_my_written_options_use_case(principal))
}

#[ic_cdk::query]
pub fn get_active_option_by_id(option_id: u64) -> Option<ActiveOption> {
    get_active_option(option_id)
}
