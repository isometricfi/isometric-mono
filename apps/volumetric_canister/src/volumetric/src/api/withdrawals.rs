use candid::CandidType;
use serde::{Deserialize, Serialize};

use crate::auth::types::{AuthenticatedPayload, SignableAction, WalletKey, WithdrawCkbtcRequest};
use crate::auth::verify_btc_signature;
use crate::errors::VolumetricError;
use crate::guards::is_whitelisted;
use crate::storage::{get_principal_for_wallet, increment_nonce};
use crate::usecases::withdraw_ckbtc;

use super::accounts::build_challenge_context;

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct WithdrawResult {
    pub block_index: u64,
}

impl From<withdraw_ckbtc::WithdrawResult> for WithdrawResult {
    fn from(r: withdraw_ckbtc::WithdrawResult) -> Self {
        Self {
            block_index: r.block_index,
        }
    }
}

#[ic_cdk::query]
pub fn get_withdraw_message(address: String, btc_address: String, amount: u64) -> String {
    let wallet_key = WalletKey::from_address(&address);
    let context = build_challenge_context(&wallet_key);
    let req = WithdrawCkbtcRequest {
        btc_address,
        amount,
    };
    req.signing_message(&address, &context)
}

#[ic_cdk::update]
pub async fn withdraw_ckbtc(
    req: AuthenticatedPayload<WithdrawCkbtcRequest>,
) -> Result<WithdrawResult, VolumetricError> {
    is_whitelisted().await?;

    let address = &req.wallet_proof.address;
    let wallet_key = WalletKey::from_address(address);

    let context = build_challenge_context(&wallet_key);
    let reconstructed_message = req.data.signing_message(address, &context);

    verify_btc_signature(address, &reconstructed_message, &req.wallet_proof.signature)?;

    increment_nonce(&wallet_key);

    let principal =
        get_principal_for_wallet(&wallet_key).ok_or_else(VolumetricError::profile_not_found)?;

    let params = withdraw_ckbtc::WithdrawParams {
        btc_address: req.data.btc_address,
        amount: req.data.amount,
    };

    let result = withdraw_ckbtc::withdraw_ckbtc_use_case(principal, params).await?;
    Ok(result.into())
}
