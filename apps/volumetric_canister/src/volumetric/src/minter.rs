/// Wraps ckBTC minter inter-canister calls behind a swappable implementation.
///
/// - Production: calls go through [`IcMinter`] → `ic_cdk` inter-canister calls.
/// - Tests: call [`set_minter`] to swap in a mock. `set_minter` is
///   `#[cfg(test)]` so it doesn't exist in the production binary.
use std::cell::RefCell;
use std::rc::Rc;

use async_trait::async_trait;

use crate::errors::VolumetricError;
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
                VolumetricError::inter_canister_call_failed(&format!("get_btc_address: {:?}", e))
            })?;

        let btc_address: String = response.candid().map_err(|e| {
            VolumetricError::inter_canister_call_failed(&format!("get_btc_address decode: {:?}", e))
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
                VolumetricError::inter_canister_call_failed(&format!("update_balance: {:?}", e))
            })?;

        let result: Result<Vec<UtxoStatus>, UpdateBalanceError> =
            response.candid().map_err(|e| {
                VolumetricError::inter_canister_call_failed(&format!(
                    "update_balance decode: {:?}",
                    e
                ))
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
                Err(VolumetricError::inter_canister_call_failed(&format!(
                    "update_balance: {}",
                    msg
                )))
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
                VolumetricError::inter_canister_call_failed(&format!(
                    "retrieve_btc_with_approval: {:?}",
                    e
                ))
            })?;

        let result: Result<RetrieveBtcOk, RetrieveBtcWithApprovalError> =
            response.candid().map_err(|e| {
                VolumetricError::inter_canister_call_failed(&format!(
                    "retrieve_btc_with_approval decode: {:?}",
                    e
                ))
            })?;

        result.map_err(|_| {
            VolumetricError::inter_canister_call_failed("retrieve_btc_with_approval rejected")
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
