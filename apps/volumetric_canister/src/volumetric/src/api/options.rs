use candid::CandidType;
use serde::{Deserialize, Serialize};

use crate::auth::types::{AuthenticatedPayload, SignableAction, WalletKey};
use crate::auth::{
    build_challenge_context, build_challenge_message, ensure_challenge_fresh, verify_btc_signature,
};
use crate::errors::{error_codes, VolumetricError};
use crate::guards::{is_whitelisted, no_replicated_call};
use crate::journaling::OperationId;
use crate::storage::{
    get_accept, get_active_option, get_principal_for_wallet, get_settlement, increment_nonce,
    list_failed_accepts, list_failed_settlements, list_pending_accepts,
    list_pending_settlements_journal, ActiveOption, PendingAccept, PendingSettlement,
};
use crate::usecases;

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct AcceptOfferItem {
    pub offer_id: u64,
    pub quantity: u64,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct AcceptOffersRequest {
    pub items: Vec<AcceptOfferItem>,
    pub expires_at_seconds: u64,
}

impl SignableAction for AcceptOffersRequest {
    const ACTION_NAME: &'static str = "accept_offers";

    fn action_fields(&self) -> Vec<(&'static str, String)> {
        let items_encoded = self
            .items
            .iter()
            .map(|item| format!("{}:{}", item.offer_id, item.quantity))
            .collect::<Vec<_>>()
            .join(",");
        vec![("items", items_encoded)]
    }
}

#[ic_cdk::query(guard = "no_replicated_call")]
pub fn get_accept_offers_message(
    wallet_address: String,
    items: Vec<AcceptOfferItem>,
    expires_at_seconds: u64,
) -> Result<String, VolumetricError> {
    let wallet_key = WalletKey::try_from_address(&wallet_address)?;
    let context = build_challenge_context(&wallet_key, expires_at_seconds);
    let req = AcceptOffersRequest {
        items,
        expires_at_seconds,
    };
    build_challenge_message(&req, &wallet_address, &context)
}

#[ic_cdk::update]
pub fn accept_offers(
    req: AuthenticatedPayload<AcceptOffersRequest>,
) -> Result<usecases::AcceptOffersReceipt, VolumetricError> {
    is_whitelisted()?;

    let address = &req.wallet_proof.address;
    let wallet_key = WalletKey::try_from_address(address)?;

    ensure_challenge_fresh(req.data.expires_at_seconds)?;

    let context = build_challenge_context(&wallet_key, req.data.expires_at_seconds);
    let reconstructed_message = build_challenge_message(&req.data, address, &context)?;

    verify_btc_signature(address, &reconstructed_message, &req.wallet_proof.signature)?;

    increment_nonce(&wallet_key);

    let buyer_principal = get_principal_for_wallet(&wallet_key)
        .ok_or_else(|| VolumetricError::from_def(error_codes::PROFILE_NOT_FOUND, None, None))?;

    let items: Vec<usecases::AcceptOfferItem> = req
        .data
        .items
        .into_iter()
        .map(|i| usecases::AcceptOfferItem {
            offer_id: i.offer_id,
            quantity: i.quantity,
        })
        .collect();

    usecases::accept_offers_use_case(buyer_principal, items, context.nonce)
}

#[ic_cdk::query(guard = "no_replicated_call")]
pub fn get_accept_status(
    operation_id: OperationId,
) -> Result<usecases::AcceptOffersStatus, VolumetricError> {
    Ok(usecases::get_accept_status(operation_id)?)
}

#[ic_cdk::query(guard = "no_replicated_call")]
pub fn get_my_options(wallet_address: String) -> Result<Vec<ActiveOption>, VolumetricError> {
    let wallet_key = WalletKey::try_from_address(&wallet_address)?;
    let principal = get_principal_for_wallet(&wallet_key)
        .ok_or_else(|| VolumetricError::from_def(error_codes::PROFILE_NOT_FOUND, None, None))?;

    Ok(usecases::get_my_options_use_case(principal))
}

#[ic_cdk::query(guard = "no_replicated_call")]
pub fn get_my_written_options(
    wallet_address: String,
) -> Result<Vec<ActiveOption>, VolumetricError> {
    let wallet_key = WalletKey::try_from_address(&wallet_address)?;
    let principal = get_principal_for_wallet(&wallet_key)
        .ok_or_else(|| VolumetricError::from_def(error_codes::PROFILE_NOT_FOUND, None, None))?;

    Ok(usecases::get_my_written_options_use_case(principal))
}

#[ic_cdk::query(guard = "no_replicated_call")]
pub fn get_active_option_by_id(option_id: u64) -> Option<ActiveOption> {
    get_active_option(option_id)
}

#[ic_cdk::query(guard = "no_replicated_call")]
pub fn get_active_options() -> Vec<ActiveOption> {
    usecases::get_active_options_use_case()
}

#[ic_cdk::query(guard = "no_replicated_call")]
pub fn get_pending_accepts() -> Result<Vec<PendingAccept>, VolumetricError> {
    is_whitelisted()?;
    Ok(list_pending_accepts())
}

#[ic_cdk::query(guard = "no_replicated_call")]
pub fn get_failed_accepts() -> Result<Vec<PendingAccept>, VolumetricError> {
    is_whitelisted()?;
    Ok(list_failed_accepts())
}

#[ic_cdk::query(guard = "no_replicated_call")]
pub fn get_accept_by_id(id: u64) -> Result<Option<PendingAccept>, VolumetricError> {
    is_whitelisted()?;
    Ok(get_accept(id))
}

#[ic_cdk::query(guard = "no_replicated_call")]
pub fn get_pending_settlements_journal() -> Result<Vec<PendingSettlement>, VolumetricError> {
    is_whitelisted()?;
    Ok(list_pending_settlements_journal())
}

#[ic_cdk::query(guard = "no_replicated_call")]
pub fn get_failed_settlements() -> Result<Vec<PendingSettlement>, VolumetricError> {
    is_whitelisted()?;
    Ok(list_failed_settlements())
}

#[ic_cdk::query(guard = "no_replicated_call")]
pub fn get_settlement_by_id(option_id: u64) -> Result<Option<PendingSettlement>, VolumetricError> {
    is_whitelisted()?;
    Ok(get_settlement(option_id))
}
