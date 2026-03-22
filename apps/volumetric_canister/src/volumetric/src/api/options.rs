use candid::CandidType;
use serde::{Deserialize, Serialize};

use crate::auth::types::{AuthenticatedPayload, ChallengeContext, SignableAction, WalletKey};
use crate::auth::{build_challenge_context, verify_btc_signature};
use crate::errors::{error_codes, VolumetricError};
use crate::guards::{is_controller, is_whitelisted};
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
}

impl SignableAction for AcceptOffersRequest {
    fn signing_message(&self, address: &str, context: &ChallengeContext) -> String {
        let items_desc: Vec<String> = self
            .items
            .iter()
            .map(|item| format!("offer #{}: {} sats", item.offer_id, item.quantity))
            .collect();
        format!(
            "Accept offers\n{}\nAddress: {}\nCanister: {}\nNetwork: {}\nNonce: {}",
            items_desc.join("\n"),
            address,
            context.canister_id,
            context.network,
            context.nonce
        )
    }
}

#[ic_cdk::query]
pub fn get_accept_offers_message(wallet_address: String, items: Vec<AcceptOfferItem>) -> String {
    let wallet_key = WalletKey::from_address(&wallet_address);
    let context = build_challenge_context(&wallet_key);
    let req = AcceptOffersRequest { items };
    req.signing_message(&wallet_address, &context)
}

#[ic_cdk::update]
pub fn accept_offers(
    req: AuthenticatedPayload<AcceptOffersRequest>,
) -> Result<usecases::AcceptOffersReceipt, VolumetricError> {
    is_whitelisted()?;

    let address = &req.wallet_proof.address;
    let wallet_key = WalletKey::from_address(address);

    let context = build_challenge_context(&wallet_key);
    let reconstructed_message = req.data.signing_message(address, &context);

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

#[ic_cdk::query]
pub fn get_accept_status(
    operation_id: OperationId,
) -> Result<usecases::AcceptOffersStatus, VolumetricError> {
    Ok(usecases::get_accept_status_use_case(operation_id)?)
}

#[ic_cdk::query]
pub fn get_my_options(wallet_address: String) -> Result<Vec<ActiveOption>, VolumetricError> {
    let wallet_key = WalletKey::from_address(&wallet_address);
    let principal = get_principal_for_wallet(&wallet_key)
        .ok_or_else(|| VolumetricError::from_def(error_codes::PROFILE_NOT_FOUND, None, None))?;

    Ok(usecases::get_my_options_use_case(principal))
}

#[ic_cdk::query]
pub fn get_my_written_options(
    wallet_address: String,
) -> Result<Vec<ActiveOption>, VolumetricError> {
    let wallet_key = WalletKey::from_address(&wallet_address);
    let principal = get_principal_for_wallet(&wallet_key)
        .ok_or_else(|| VolumetricError::from_def(error_codes::PROFILE_NOT_FOUND, None, None))?;

    Ok(usecases::get_my_written_options_use_case(principal))
}

#[ic_cdk::query]
pub fn get_active_option_by_id(option_id: u64) -> Option<ActiveOption> {
    get_active_option(option_id)
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct ClearStorageResponse {
    pub offers_cleared: u64,
    pub options_cleared: u64,
}

/// Testing endpoint to clear all offers and active options from storage.
/// Use this for storage migration when schema changes break deserialization.
#[ic_cdk::update]
pub fn testing_clear_offers_and_options() -> Result<ClearStorageResponse, VolumetricError> {
    is_whitelisted()?;

    let offers_cleared = crate::storage::clear_offers();
    let options_cleared = crate::storage::clear_active_options();

    Ok(ClearStorageResponse {
        offers_cleared,
        options_cleared,
    })
}

#[ic_cdk::query]
pub fn get_pending_accepts() -> Result<Vec<PendingAccept>, VolumetricError> {
    is_controller()?;
    Ok(list_pending_accepts())
}

#[ic_cdk::query]
pub fn get_failed_accepts() -> Result<Vec<PendingAccept>, VolumetricError> {
    is_controller()?;
    Ok(list_failed_accepts())
}

#[ic_cdk::query]
pub fn get_accept_by_id(id: u64) -> Result<Option<PendingAccept>, VolumetricError> {
    is_controller()?;
    Ok(get_accept(id))
}

#[ic_cdk::query]
pub fn get_pending_settlements_journal() -> Result<Vec<PendingSettlement>, VolumetricError> {
    is_controller()?;
    Ok(list_pending_settlements_journal())
}

#[ic_cdk::query]
pub fn get_failed_settlements() -> Result<Vec<PendingSettlement>, VolumetricError> {
    is_controller()?;
    Ok(list_failed_settlements())
}

#[ic_cdk::query]
pub fn get_settlement_by_id(option_id: u64) -> Result<Option<PendingSettlement>, VolumetricError> {
    is_controller()?;
    Ok(get_settlement(option_id))
}
