use candid::CandidType;
use serde::{Deserialize, Serialize};

use crate::auth::types::{AuthenticatedPayload, SignableAction, WalletKey};
use crate::auth::{
    build_challenge_context, build_challenge_message, ensure_challenge_fresh, verify_btc_signature,
};
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
    pub offer_valid_until_seconds: u64,
    pub option_duration_seconds: u64,
    pub expires_at_seconds: u64,
}

impl SignableAction for CreateOfferRequest {
    const ACTION_NAME: &'static str = "create_offer";

    fn action_fields(&self) -> Vec<(&'static str, String)> {
        let asset_tag = match self.asset {
            Asset::CkBtc => "ckbtc",
        };
        let option_type_tag = match self.option_type {
            OptionType::Call => "call",
        };
        vec![
            ("asset", asset_tag.to_string()),
            (
                "offer_valid_until_seconds",
                self.offer_valid_until_seconds.to_string(),
            ),
            (
                "option_duration_seconds",
                self.option_duration_seconds.to_string(),
            ),
            ("option_type", option_type_tag.to_string()),
            (
                "premium_basis_points",
                self.premium_basis_points.to_string(),
            ),
            ("quantity_sats", self.quantity.to_string()),
            ("strike_basis_points", self.strike_basis_points.to_string()),
        ]
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
    option_duration_seconds: u64,
    offer_valid_until_seconds: u64,
    expires_at_seconds: u64,
) -> Result<String, VolumetricError> {
    let wallet_key = WalletKey::try_from_address(&wallet_address)?;
    let context = build_challenge_context(&wallet_key, expires_at_seconds);
    let req = CreateOfferRequest {
        asset: Asset::CkBtc,
        option_type: OptionType::Call,
        strike_basis_points,
        premium_basis_points,
        quantity,
        offer_valid_until_seconds,
        option_duration_seconds,
        expires_at_seconds,
    };
    build_challenge_message(&req, &wallet_address, &context)
}

#[ic_cdk::update]
pub fn create_offer(
    req: AuthenticatedPayload<CreateOfferRequest>,
) -> Result<CreateOfferResponse, VolumetricError> {
    is_whitelisted()?;

    let address = &req.wallet_proof.address;
    let wallet_key = WalletKey::try_from_address(address)?;

    ensure_challenge_fresh(req.data.expires_at_seconds)?;

    let context = build_challenge_context(&wallet_key, req.data.expires_at_seconds);
    let reconstructed_message = build_challenge_message(&req.data, address, &context)?;

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
        offer_valid_until_seconds: req.data.offer_valid_until_seconds,
        option_duration_seconds: req.data.option_duration_seconds,
    };

    let offer = usecases::create_offer_use_case(principal, params)?;

    Ok(CreateOfferResponse { offer })
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct CancelOfferRequest {
    pub offer_id: u64,
    pub expires_at_seconds: u64,
}

impl SignableAction for CancelOfferRequest {
    const ACTION_NAME: &'static str = "cancel_offer";

    fn action_fields(&self) -> Vec<(&'static str, String)> {
        vec![("offer_id", self.offer_id.to_string())]
    }
}

#[ic_cdk::query]
pub fn get_cancel_offer_message(
    wallet_address: String,
    offer_id: u64,
    expires_at_seconds: u64,
) -> Result<String, VolumetricError> {
    let wallet_key = WalletKey::try_from_address(&wallet_address)?;
    let context = build_challenge_context(&wallet_key, expires_at_seconds);
    let req = CancelOfferRequest {
        offer_id,
        expires_at_seconds,
    };
    build_challenge_message(&req, &wallet_address, &context)
}

#[ic_cdk::update]
pub fn cancel_offer(
    req: AuthenticatedPayload<CancelOfferRequest>,
) -> Result<Offer, VolumetricError> {
    is_whitelisted()?;

    let address = &req.wallet_proof.address;
    let wallet_key = WalletKey::try_from_address(address)?;

    ensure_challenge_fresh(req.data.expires_at_seconds)?;

    let context = build_challenge_context(&wallet_key, req.data.expires_at_seconds);
    let reconstructed_message = build_challenge_message(&req.data, address, &context)?;

    verify_btc_signature(address, &reconstructed_message, &req.wallet_proof.signature)?;

    increment_nonce(&wallet_key);

    let principal = get_principal_for_wallet(&wallet_key)
        .ok_or_else(|| VolumetricError::from_def(error_codes::PROFILE_NOT_FOUND, None, None))?;

    usecases::cancel_offer_use_case(principal, req.data.offer_id)
}

#[ic_cdk::query]
pub fn get_my_offers(wallet_address: String) -> Result<Vec<Offer>, VolumetricError> {
    let wallet_key = WalletKey::try_from_address(&wallet_address)?;
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
