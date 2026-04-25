use candid::Decode;

use volumetric::auth::types::WalletProof;
use volumetric::errors::error_codes;
use volumetric::journaling::OperationId;
use volumetric::{
    AcceptOfferItem, AcceptOffersReceipt, AcceptOffersRequest, AcceptOffersResult,
    AcceptOffersStatus, Asset, AuthenticatedPayload, CancelOfferRequest, CreateOfferRequest,
    CreateOfferResponse, Offer, OptionType, VolumetricError,
};

use crate::common::{wallets, TestEnv, TestWallet};

const NANOS_PER_SECOND: u64 = 1_000_000_000;
const ONE_HOUR_SECONDS: u64 = 3_600;
const SIGNING_WINDOW_SECONDS: u64 = 300;
const MAX_ACCEPT_STATUS_POLLS: usize = 20;

fn expires_at_seconds(env: &TestEnv) -> u64 {
    env.get_time_ns() / 1_000_000_000 + SIGNING_WINDOW_SECONDS
}

pub fn get_create_offer_message(
    env: &TestEnv,
    address: &str,
    quantity: u64,
    strike_bps: u16,
    premium_bps: u16,
    option_duration_seconds: u64,
    offer_valid_until_seconds: u64,
    expires_at_seconds: u64,
) -> String {
    let response = env
        .pic
        .query_call(
            env.volumetric_canister,
            candid::Principal::anonymous(),
            "get_create_offer_message",
            candid::encode_args((
                address.to_string(),
                quantity,
                strike_bps,
                premium_bps,
                option_duration_seconds,
                offer_valid_until_seconds,
                expires_at_seconds,
            ))
            .unwrap(),
        )
        .expect("Query failed");
    Decode!(&response, Result<String, VolumetricError>)
        .expect("decode get_create_offer_message")
        .expect("get_create_offer_message")
}

pub fn get_accept_offers_message(
    env: &TestEnv,
    address: &str,
    items: Vec<AcceptOfferItem>,
    expires_at_seconds: u64,
) -> String {
    let response = env
        .pic
        .query_call(
            env.volumetric_canister,
            candid::Principal::anonymous(),
            "get_accept_offers_message",
            candid::encode_args((address.to_string(), items, expires_at_seconds)).unwrap(),
        )
        .expect("Query failed");
    Decode!(&response, Result<String, VolumetricError>)
        .expect("decode get_accept_offers_message")
        .expect("get_accept_offers_message")
}

pub fn create_offer(
    env: &TestEnv,
    wallet: &TestWallet,
    quantity: u64,
    strike_bps: u16,
    premium_bps: u16,
    duration_secs: u64,
) -> Result<CreateOfferResponse, VolumetricError> {
    let now_seconds = env.get_time_ns() / NANOS_PER_SECOND;
    let valid_until_seconds = now_seconds + ONE_HOUR_SECONDS;
    let expires_at = expires_at_seconds(env);

    let message = get_create_offer_message(
        env,
        &wallet.address,
        quantity,
        strike_bps,
        premium_bps,
        duration_secs,
        valid_until_seconds,
        expires_at,
    );
    let signature = wallets::sign_message(wallet, &message);

    let payload = AuthenticatedPayload {
        data: CreateOfferRequest {
            asset: Asset::CkBtc,
            option_type: OptionType::Call,
            strike_basis_points: strike_bps,
            premium_basis_points: premium_bps,
            quantity,
            offer_valid_until_seconds: valid_until_seconds,
            option_duration_seconds: duration_secs,
            expires_at_seconds: expires_at,
        },
        wallet_proof: WalletProof {
            address: wallet.address.clone(),
            signature,
        },
    };

    let response = env
        .pic
        .update_call(
            env.volumetric_canister,
            env.controller,
            "create_offer",
            candid::encode_one(payload).unwrap(),
        )
        .expect("Update call failed");

    Decode!(&response, Result<CreateOfferResponse, VolumetricError>).unwrap()
}

pub fn accept_offers(
    env: &TestEnv,
    wallet: &TestWallet,
    items: Vec<AcceptOfferItem>,
) -> Result<AcceptOffersResult, VolumetricError> {
    let expires_at = expires_at_seconds(env);
    let message = get_accept_offers_message(env, &wallet.address, items.clone(), expires_at);
    let signature = wallets::sign_message(wallet, &message);

    let payload = AuthenticatedPayload {
        data: AcceptOffersRequest {
            items,
            expires_at_seconds: expires_at,
        },
        wallet_proof: WalletProof {
            address: wallet.address.clone(),
            signature,
        },
    };

    let response = env
        .pic
        .update_call(
            env.volumetric_canister,
            env.controller,
            "accept_offers",
            candid::encode_one(payload).unwrap(),
        )
        .expect("Update call failed");

    let receipt = Decode!(&response, Result<AcceptOffersReceipt, VolumetricError>).unwrap()?;

    for _ in 0..MAX_ACCEPT_STATUS_POLLS {
        match get_accept_status(env, receipt.operation_id)? {
            AcceptOffersStatus::Succeeded { result, .. } => {
                return Ok(result);
            }
            AcceptOffersStatus::Pending { .. } | AcceptOffersStatus::RecoveryRequired { .. } => {
                env.pic.tick();
            }
            AcceptOffersStatus::Failed { message, .. } => {
                return Err(VolumetricError::from_def(
                    error_codes::INTER_CANISTER_CALL_FAILED,
                    Some(&message),
                    None,
                ));
            }
        }
    }

    Err(VolumetricError::from_def(
        error_codes::INTER_CANISTER_CALL_FAILED,
        Some("accept status did not complete in helper polling window"),
        None,
    ))
}

fn get_accept_status(
    env: &TestEnv,
    operation_id: OperationId,
) -> Result<AcceptOffersStatus, VolumetricError> {
    let response = env
        .pic
        .query_call(
            env.volumetric_canister,
            candid::Principal::anonymous(),
            "get_accept_status",
            candid::encode_one(operation_id).unwrap(),
        )
        .expect("Query failed");

    Decode!(&response, Result<AcceptOffersStatus, VolumetricError>).unwrap()
}

pub fn get_open_offers(env: &TestEnv) -> Vec<Offer> {
    let response = env
        .pic
        .query_call(
            env.volumetric_canister,
            candid::Principal::anonymous(),
            "get_open_offers",
            candid::encode_one(()).unwrap(),
        )
        .expect("Query failed");

    Decode!(&response, Vec<Offer>).unwrap()
}

pub fn get_cancel_offer_message(
    env: &TestEnv,
    address: &str,
    offer_id: u64,
    expires_at_seconds: u64,
) -> String {
    let response = env
        .pic
        .query_call(
            env.volumetric_canister,
            candid::Principal::anonymous(),
            "get_cancel_offer_message",
            candid::encode_args((address.to_string(), offer_id, expires_at_seconds)).unwrap(),
        )
        .expect("Query failed");
    Decode!(&response, Result<String, VolumetricError>)
        .expect("decode get_cancel_offer_message")
        .expect("get_cancel_offer_message")
}

pub fn cancel_offer(
    env: &TestEnv,
    wallet: &TestWallet,
    offer_id: u64,
) -> Result<Offer, VolumetricError> {
    let expires_at = expires_at_seconds(env);
    let message = get_cancel_offer_message(env, &wallet.address, offer_id, expires_at);
    let signature = wallets::sign_message(wallet, &message);

    let payload = AuthenticatedPayload {
        data: CancelOfferRequest {
            offer_id,
            expires_at_seconds: expires_at,
        },
        wallet_proof: WalletProof {
            address: wallet.address.clone(),
            signature,
        },
    };

    let response = env
        .pic
        .update_call(
            env.volumetric_canister,
            env.controller,
            "cancel_offer",
            candid::encode_one(payload).unwrap(),
        )
        .expect("Update call failed");

    Decode!(&response, Result<Offer, VolumetricError>).unwrap()
}
