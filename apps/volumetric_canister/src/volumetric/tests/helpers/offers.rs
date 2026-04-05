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

const ONE_HOUR_NS: u64 = 3_600_000_000_000;
const MAX_ACCEPT_STATUS_POLLS: usize = 20;

pub fn get_create_offer_message(
    env: &TestEnv,
    address: &str,
    quantity: u64,
    strike_bps: u16,
    premium_bps: u16,
) -> String {
    let response = env
        .pic
        .query_call(
            env.volumetric_canister,
            candid::Principal::anonymous(),
            "get_create_offer_message",
            candid::encode_args((address.to_string(), quantity, strike_bps, premium_bps)).unwrap(),
        )
        .expect("Query failed");
    Decode!(&response, String).unwrap()
}

pub fn get_accept_offers_message(
    env: &TestEnv,
    address: &str,
    items: Vec<AcceptOfferItem>,
) -> String {
    let response = env
        .pic
        .query_call(
            env.volumetric_canister,
            candid::Principal::anonymous(),
            "get_accept_offers_message",
            candid::encode_args((address.to_string(), items)).unwrap(),
        )
        .expect("Query failed");
    Decode!(&response, String).unwrap()
}

pub fn create_offer(
    env: &TestEnv,
    wallet: &TestWallet,
    quantity: u64,
    strike_bps: u16,
    premium_bps: u16,
    duration_secs: u64,
) -> Result<CreateOfferResponse, VolumetricError> {
    let message = get_create_offer_message(env, &wallet.address, quantity, strike_bps, premium_bps);
    let signature = wallets::sign_message(wallet, &message);

    let now = env.pic.get_time().as_nanos_since_unix_epoch();
    let valid_until = now + ONE_HOUR_NS;

    let payload = AuthenticatedPayload {
        data: CreateOfferRequest {
            asset: Asset::CkBtc,
            option_type: OptionType::Call,
            strike_basis_points: strike_bps,
            premium_basis_points: premium_bps,
            quantity,
            offer_valid_until: valid_until,
            option_duration_seconds: duration_secs,
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
    let message = get_accept_offers_message(env, &wallet.address, items.clone());
    let signature = wallets::sign_message(wallet, &message);

    let payload = AuthenticatedPayload {
        data: AcceptOffersRequest { items },
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

pub fn get_cancel_offer_message(env: &TestEnv, address: &str, offer_id: u64) -> String {
    let response = env
        .pic
        .query_call(
            env.volumetric_canister,
            candid::Principal::anonymous(),
            "get_cancel_offer_message",
            candid::encode_args((address.to_string(), offer_id)).unwrap(),
        )
        .expect("Query failed");
    Decode!(&response, String).unwrap()
}

pub fn cancel_offer(
    env: &TestEnv,
    wallet: &TestWallet,
    offer_id: u64,
) -> Result<Offer, VolumetricError> {
    let message = get_cancel_offer_message(env, &wallet.address, offer_id);
    let signature = wallets::sign_message(wallet, &message);

    let payload = AuthenticatedPayload {
        data: CancelOfferRequest { offer_id },
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
