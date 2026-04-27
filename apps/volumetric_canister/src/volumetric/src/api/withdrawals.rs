use crate::auth::types::{
    AuthenticatedPayload, ListMyPendingWithdrawalsRequest, WalletKey, WithdrawCkbtcRequest,
};
use crate::auth::{
    build_challenge_context, build_challenge_message, ensure_challenge_fresh, verify_btc_signature,
};
use crate::errors::{error_codes, VolumetricError};
use crate::guards::{is_controller, is_whitelisted, no_replicated_call};
use crate::journaling::OperationId;
use crate::storage::{
    get_pending_withdrawals_by_principal, get_principal_for_wallet, get_withdrawal,
    increment_nonce, list_failed_withdrawals, list_pending_withdrawals, PendingWithdrawal,
};
use crate::usecases;

#[ic_cdk::query(guard = "no_replicated_call")]
pub fn get_my_pending_withdrawals_message(
    address: String,
    expires_at_seconds: u64,
) -> Result<String, VolumetricError> {
    let wallet_key = WalletKey::try_from_address(&address)?;
    let context = build_challenge_context(&wallet_key, expires_at_seconds);
    let req = ListMyPendingWithdrawalsRequest { expires_at_seconds };
    build_challenge_message(&req, &address, &context)
}

#[ic_cdk::query(guard = "no_replicated_call")]
pub fn get_withdraw_message(
    address: String,
    btc_address: String,
    amount: u64,
    expires_at_seconds: u64,
) -> Result<String, VolumetricError> {
    let wallet_key = WalletKey::try_from_address(&address)?;
    let context = build_challenge_context(&wallet_key, expires_at_seconds);
    let req = WithdrawCkbtcRequest {
        btc_address,
        amount,
        expires_at_seconds,
    };
    build_challenge_message(&req, &address, &context)
}

#[ic_cdk::update]
pub fn withdraw_ckbtc(
    req: AuthenticatedPayload<WithdrawCkbtcRequest>,
) -> Result<usecases::WithdrawReceipt, VolumetricError> {
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

    let params = usecases::WithdrawParams {
        btc_address: req.data.btc_address,
        amount: req.data.amount,
    };

    usecases::withdraw_ckbtc_use_case(principal, params, context.nonce)
}

#[ic_cdk::query(guard = "no_replicated_call")]
pub fn get_withdraw_status(
    operation_id: OperationId,
) -> Result<usecases::WithdrawStatus, VolumetricError> {
    Ok(usecases::get_withdraw_status_use_case(operation_id)?)
}

#[ic_cdk::query(guard = "no_replicated_call")]
pub fn get_pending_withdrawals() -> Result<Vec<PendingWithdrawal>, VolumetricError> {
    is_controller()?;
    Ok(list_pending_withdrawals())
}

#[ic_cdk::query(guard = "no_replicated_call")]
pub fn get_failed_withdrawals() -> Result<Vec<PendingWithdrawal>, VolumetricError> {
    is_controller()?;
    Ok(list_failed_withdrawals())
}

#[ic_cdk::query(guard = "no_replicated_call")]
pub fn get_withdrawal_by_id(id: u64) -> Result<Option<PendingWithdrawal>, VolumetricError> {
    is_controller()?;
    Ok(get_withdrawal(id))
}

#[ic_cdk::query(guard = "no_replicated_call")]
pub fn get_my_pending_withdrawals(
    req: AuthenticatedPayload<ListMyPendingWithdrawalsRequest>,
) -> Result<Vec<PendingWithdrawal>, VolumetricError> {
    is_whitelisted()?;

    let address = &req.wallet_proof.address;
    let wallet_key = WalletKey::try_from_address(address)?;

    ensure_challenge_fresh(req.data.expires_at_seconds)?;

    let context = build_challenge_context(&wallet_key, req.data.expires_at_seconds);
    let reconstructed_message = build_challenge_message(&req.data, address, &context)?;

    verify_btc_signature(address, &reconstructed_message, &req.wallet_proof.signature)?;

    let principal = get_principal_for_wallet(&wallet_key)
        .ok_or_else(|| VolumetricError::from_def(error_codes::PROFILE_NOT_FOUND, None, None))?;

    Ok(get_pending_withdrawals_by_principal(principal))
}
