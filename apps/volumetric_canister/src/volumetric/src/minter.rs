/// Wraps ckBTC minter inter-canister calls behind a swappable implementation.
///
/// - Production: calls go through [`IcMinter`] → `ic_cdk` inter-canister calls.
/// - Tests: call [`set_minter`] to swap in a mock. `set_minter` is
///   `#[cfg(test)]` so it doesn't exist in the production binary.
use std::cell::RefCell;
use std::rc::Rc;

use async_trait::async_trait;

use crate::errors::{error_codes, VolumetricError};
use crate::generated::ckbtc::{
    GetBtcAddressArg, RetrieveBtcOk, RetrieveBtcWithApprovalArgs, RetrieveBtcWithApprovalError,
    UpdateBalanceArg, UpdateBalanceError, UtxoStatus,
};
use crate::storage::Config;

#[async_trait(?Send)]
pub trait MinterClient {
    async fn get_btc_address(&self, args: GetBtcAddressArg) -> Result<String, VolumetricError>;

    async fn update_balance(
        &self,
        args: UpdateBalanceArg,
    ) -> Result<Vec<UtxoStatus>, VolumetricError>;

    async fn retrieve_btc_with_approval(
        &self,
        args: RetrieveBtcWithApprovalArgs,
    ) -> Result<RetrieveBtcOk, VolumetricError>;
}

fn format_retrieve_error(e: RetrieveBtcWithApprovalError) -> String {
    match e {
        RetrieveBtcWithApprovalError::MalformedAddress(addr) => {
            format!("malformed address: {}", addr)
        }
        RetrieveBtcWithApprovalError::GenericError {
            error_message,
            error_code,
        } => format!("generic error {}: {}", error_code, error_message),
        RetrieveBtcWithApprovalError::TemporarilyUnavailable(msg) => {
            format!("temporarily unavailable: {}", msg)
        }
        RetrieveBtcWithApprovalError::InsufficientAllowance { allowance } => {
            format!("insufficient allowance: {}", allowance)
        }
        RetrieveBtcWithApprovalError::AlreadyProcessing => "already processing".to_string(),
        RetrieveBtcWithApprovalError::AmountTooLow(min) => {
            format!("amount too low, minimum: {}", min)
        }
        RetrieveBtcWithApprovalError::InsufficientFunds { balance } => {
            format!("insufficient funds, balance: {}", balance)
        }
    }
}

/// Production implementation — delegates to ckBTC minter via `ic_cdk`.
struct IcMinter;

#[async_trait(?Send)]
impl MinterClient for IcMinter {
    async fn get_btc_address(&self, args: GetBtcAddressArg) -> Result<String, VolumetricError> {
        let minter = Config::ckbtc_minter();

        let response = ic_cdk::call::Call::unbounded_wait(minter, "get_btc_address")
            .with_arg(&args)
            .await
            .map_err(|e| {
                VolumetricError::from_def(
                    error_codes::INTER_CANISTER_CALL_FAILED,
                    Some(&format!("get_btc_address: {:?}", e)),
                    None,
                )
            })?;

        let btc_address: String = response.candid().map_err(|e| {
            VolumetricError::from_def(
                error_codes::INTER_CANISTER_CALL_FAILED,
                Some(&format!("get_btc_address decode: {:?}", e)),
                None,
            )
        })?;

        Ok(btc_address)
    }

    async fn update_balance(
        &self,
        args: UpdateBalanceArg,
    ) -> Result<Vec<UtxoStatus>, VolumetricError> {
        let minter = Config::ckbtc_minter();

        let response = ic_cdk::call::Call::unbounded_wait(minter, "update_balance")
            .with_arg(&args)
            .await
            .map_err(|e| {
                VolumetricError::from_def(
                    error_codes::INTER_CANISTER_CALL_FAILED,
                    Some(&format!("update_balance: {:?}", e)),
                    None,
                )
            })?;

        let result: Result<Vec<UtxoStatus>, UpdateBalanceError> =
            response.candid().map_err(|e| {
                VolumetricError::from_def(
                    error_codes::INTER_CANISTER_CALL_FAILED,
                    Some(&format!("update_balance decode: {:?}", e)),
                    None,
                )
            })?;

        match result {
            Ok(statuses) => Ok(statuses),
            Err(UpdateBalanceError::NoNewUtxos { .. }) => Ok(vec![]),
            Err(e) => {
                let msg = match e {
                    UpdateBalanceError::GenericError { error_message, .. } => error_message,
                    UpdateBalanceError::TemporarilyUnavailable(msg) => msg,
                    UpdateBalanceError::AlreadyProcessing => "Already processing".to_string(),
                    UpdateBalanceError::NoNewUtxos { .. } => unreachable!(),
                };
                Err(VolumetricError::from_def(
                    error_codes::INTER_CANISTER_CALL_FAILED,
                    Some(&format!("update_balance: {}", msg)),
                    None,
                ))
            }
        }
    }

    async fn retrieve_btc_with_approval(
        &self,
        args: RetrieveBtcWithApprovalArgs,
    ) -> Result<RetrieveBtcOk, VolumetricError> {
        let minter = Config::ckbtc_minter();

        let response = ic_cdk::call::Call::unbounded_wait(minter, "retrieve_btc_with_approval")
            .with_arg(&args)
            .await
            .map_err(|e| {
                VolumetricError::from_def(
                    error_codes::INTER_CANISTER_CALL_FAILED,
                    Some(&format!("retrieve_btc_with_approval: {:?}", e)),
                    None,
                )
            })?;

        let result: Result<RetrieveBtcOk, RetrieveBtcWithApprovalError> =
            response.candid().map_err(|e| {
                VolumetricError::from_def(
                    error_codes::INTER_CANISTER_CALL_FAILED,
                    Some(&format!("retrieve_btc_with_approval decode: {:?}", e)),
                    None,
                )
            })?;

        result.map_err(|e| {
            VolumetricError::from_def(
                error_codes::INTER_CANISTER_CALL_FAILED,
                Some(&format!(
                    "retrieve_btc_with_approval rejected: {}",
                    format_retrieve_error(e)
                )),
                None,
            )
        })
    }
}

thread_local! {
    static MINTER: RefCell<Rc<dyn MinterClient>> = RefCell::new(Rc::new(IcMinter));
}

pub async fn get_btc_address(args: GetBtcAddressArg) -> Result<String, VolumetricError> {
    let minter = MINTER.with(|m| Rc::clone(&m.borrow()));
    minter.get_btc_address(args).await
}

pub async fn update_balance(args: UpdateBalanceArg) -> Result<Vec<UtxoStatus>, VolumetricError> {
    let minter = MINTER.with(|m| Rc::clone(&m.borrow()));
    minter.update_balance(args).await
}

pub async fn retrieve_btc_with_approval(
    args: RetrieveBtcWithApprovalArgs,
) -> Result<RetrieveBtcOk, VolumetricError> {
    let minter = MINTER.with(|m| Rc::clone(&m.borrow()));
    minter.retrieve_btc_with_approval(args).await
}

/// Swap the minter implementation (test-only, compiled out in production).
#[cfg(test)]
pub fn set_minter(client: Rc<dyn MinterClient>) {
    MINTER.with(|m| *m.borrow_mut() = client);
}
