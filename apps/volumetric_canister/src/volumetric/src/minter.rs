use crate::errors::VolumetricError;
use crate::generated::ckbtc::{
    GetBtcAddressArg, RetrieveBtcOk, RetrieveBtcWithApprovalArgs, RetrieveBtcWithApprovalError,
    UpdateBalanceArg, UpdateBalanceError, UtxoStatus,
};
use crate::storage::Config;

#[allow(async_fn_in_trait)]
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

struct IcMinter;

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

pub async fn get_btc_address(args: GetBtcAddressArg) -> Result<String, VolumetricError> {
    IcMinter.get_btc_address(args).await
}

pub async fn update_balance(args: UpdateBalanceArg) -> Result<Vec<UtxoStatus>, VolumetricError> {
    IcMinter.update_balance(args).await
}

pub async fn retrieve_btc_with_approval(
    args: RetrieveBtcWithApprovalArgs,
) -> Result<RetrieveBtcOk, VolumetricError> {
    IcMinter.retrieve_btc_with_approval(args).await
}
