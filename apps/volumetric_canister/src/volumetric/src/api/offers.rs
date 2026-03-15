use candid::CandidType;
use serde::{Deserialize, Serialize};

use crate::auth::types::{AuthenticatedPayload, ChallengeContext, SignableAction, WalletKey};
use crate::auth::{build_challenge_context, verify_btc_signature};
use crate::errors::{error_codes, VolumetricError};
use crate::guards::is_whitelisted;
use crate::storage::{
    get_offer, get_principal_for_wallet, increment_nonce, list_offers_by_writer, Asset, Offer,
    OptionType,
};
use crate::usecases;

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct CreateOfferRequest {
    pub asset: Asset,
    pub option_type: OptionType,
    pub strike_basis_points: u16,
    pub premium_basis_points: u16,
    pub quantity: u64,
    pub offer_valid_until: u64,
    pub option_duration_seconds: u64,
}

impl SignableAction for CreateOfferRequest {
    fn signing_message(&self, address: &str, context: &ChallengeContext) -> String {
        format!(
            "Create option offer\nQuantity: {} sats\nStrike: {} bps\nPremium: {} bps\nAddress: {}\nCanister: {}\nNetwork: {}\nNonce: {}",
            self.quantity, self.strike_basis_points, self.premium_basis_points,
            address, context.canister_id, context.network, context.nonce
        )
    }
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct CreateOfferResponse {
    pub offer: Offer,
}

#[ic_cdk::query]
pub fn get_create_offer_message(
    wallet_address: String,
    quantity: u64,
    strike_basis_points: u16,
    premium_basis_points: u16,
) -> String {
    let wallet_key = WalletKey::from_address(&wallet_address);
    let context = build_challenge_context(&wallet_key);
    let req = CreateOfferRequest {
        asset: Asset::CkBtc,
        option_type: OptionType::Call,
        strike_basis_points,
        premium_basis_points,
        quantity,
        offer_valid_until: 0,
        option_duration_seconds: 0,
    };
    req.signing_message(&wallet_address, &context)
}

#[ic_cdk::update]
pub async fn create_offer(
    req: AuthenticatedPayload<CreateOfferRequest>,
) -> Result<CreateOfferResponse, VolumetricError> {
    is_whitelisted().await?;

    let address = &req.wallet_proof.address;
    let wallet_key = WalletKey::from_address(address);

    let context = build_challenge_context(&wallet_key);
    let reconstructed_message = req.data.signing_message(address, &context);

    verify_btc_signature(address, &reconstructed_message, &req.wallet_proof.signature)?;

    increment_nonce(&wallet_key);

    let principal = get_principal_for_wallet(&wallet_key)
        .ok_or_else(|| VolumetricError::from_def(error_codes::PROFILE_NOT_FOUND, None, None))?;

    let params = usecases::CreateOfferParams {
        asset: req.data.asset,
        option_type: req.data.option_type,
        strike_basis_points: req.data.strike_basis_points,
        premium_basis_points: req.data.premium_basis_points,
        quantity: req.data.quantity,
        offer_valid_until: req.data.offer_valid_until,
        option_duration_seconds: req.data.option_duration_seconds,
    };

    let offer = usecases::create_offer_use_case(principal, params)?;

    Ok(CreateOfferResponse { offer })
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct CancelOfferRequest {
    pub offer_id: u64,
}

impl SignableAction for CancelOfferRequest {
    fn signing_message(&self, address: &str, context: &ChallengeContext) -> String {
        format!(
            "Cancel offer #{}\nAddress: {}\nCanister: {}\nNetwork: {}\nNonce: {}",
            self.offer_id, address, context.canister_id, context.network, context.nonce
        )
    }
}

#[ic_cdk::query]
pub fn get_cancel_offer_message(wallet_address: String, offer_id: u64) -> String {
    let wallet_key = WalletKey::from_address(&wallet_address);
    let context = build_challenge_context(&wallet_key);
    let req = CancelOfferRequest { offer_id };
    req.signing_message(&wallet_address, &context)
}

#[ic_cdk::update]
pub async fn cancel_offer(
    req: AuthenticatedPayload<CancelOfferRequest>,
) -> Result<Offer, VolumetricError> {
    is_whitelisted().await?;

    let address = &req.wallet_proof.address;
    let wallet_key = WalletKey::from_address(address);

    let context = build_challenge_context(&wallet_key);
    let reconstructed_message = req.data.signing_message(address, &context);

    verify_btc_signature(address, &reconstructed_message, &req.wallet_proof.signature)?;

    increment_nonce(&wallet_key);

    let principal = get_principal_for_wallet(&wallet_key)
        .ok_or_else(|| VolumetricError::from_def(error_codes::PROFILE_NOT_FOUND, None, None))?;

    usecases::cancel_offer_use_case(principal, req.data.offer_id)
}

#[ic_cdk::query]
pub fn get_my_offers(wallet_address: String) -> Result<Vec<Offer>, VolumetricError> {
    let wallet_key = WalletKey::from_address(&wallet_address);
    let principal = get_principal_for_wallet(&wallet_key)
        .ok_or_else(|| VolumetricError::from_def(error_codes::PROFILE_NOT_FOUND, None, None))?;

    Ok(list_offers_by_writer(principal))
}

#[ic_cdk::query]
pub fn get_open_offers() -> Vec<Offer> {
    usecases::get_open_offers_use_case()
}

#[ic_cdk::query]
pub fn get_offer_by_id(offer_id: u64) -> Option<Offer> {
    get_offer(offer_id)
}
