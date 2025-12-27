use candid::CandidType;
use serde::{Deserialize, Serialize};

use crate::auth::types::{AuthenticatedPayload, SignableAction, WalletKey, WithdrawCkbtcRequest};
use crate::auth::{build_challenge_context, verify_btc_signature};
use crate::errors::VolumetricError;
use crate::guards::{is_controller, is_whitelisted};
use crate::storage::{
    get_pending_withdrawals_by_principal, get_principal_for_wallet, get_withdrawal,
    increment_nonce, list_failed_withdrawals, list_pending_withdrawals, PendingWithdrawal,
};
use crate::usecases;

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct WithdrawResult {
    pub block_index: u64,
}

impl From<usecases::WithdrawResult> for WithdrawResult {
    fn from(r: usecases::WithdrawResult) -> Self {
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

    let params = usecases::WithdrawParams {
        btc_address: req.data.btc_address,
        amount: req.data.amount,
    };

    let result = usecases::withdraw_ckbtc_use_case(principal, params).await?;
    Ok(result.into())
}

#[ic_cdk::query]
pub async fn get_pending_withdrawals() -> Result<Vec<PendingWithdrawal>, VolumetricError> {
    is_controller().await?;
    Ok(list_pending_withdrawals())
}

#[ic_cdk::query]
pub async fn get_failed_withdrawals() -> Result<Vec<PendingWithdrawal>, VolumetricError> {
    is_controller().await?;
    Ok(list_failed_withdrawals())
}

#[ic_cdk::query]
pub async fn get_withdrawal_by_id(id: u64) -> Result<Option<PendingWithdrawal>, VolumetricError> {
    is_controller().await?;
    Ok(get_withdrawal(id))
}

#[ic_cdk::query]
pub async fn get_my_pending_withdrawals(
    req: AuthenticatedPayload<()>,
) -> Result<Vec<PendingWithdrawal>, VolumetricError> {
    is_whitelisted().await?;

    let address = &req.wallet_proof.address;
    let wallet_key = WalletKey::from_address(address);

    let principal =
        get_principal_for_wallet(&wallet_key).ok_or_else(VolumetricError::profile_not_found)?;

    Ok(get_pending_withdrawals_by_principal(principal))
}
