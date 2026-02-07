use candid::Nat;
use icrc_ledger_types::icrc1::account::Account;
use icrc_ledger_types::icrc1::transfer::TransferError;
use icrc_ledger_types::icrc2::approve::{ApproveArgs, ApproveError};

use crate::errors::VolumetricError;
use crate::storage::Config;

#[allow(async_fn_in_trait)]
pub trait LedgerClient {
    async fn icrc1_transfer(
        &self,
        from_subaccount: Option<[u8; 32]>,
        to: Account,
        amount: u64,
        created_at_time: u64,
    ) -> Result<u64, VolumetricError>;

    async fn icrc1_balance_of(&self, account: Account) -> Result<Nat, VolumetricError>;

    async fn icrc2_approve(&self, args: ApproveArgs) -> Result<Nat, VolumetricError>;
}

struct IcLedger;

impl LedgerClient for IcLedger {
    async fn icrc1_transfer(
        &self,
        from_subaccount: Option<[u8; 32]>,
        to: Account,
        amount: u64,
        created_at_time: u64,
    ) -> Result<u64, VolumetricError> {
        let ledger = Config::ckbtc_ledger();

        let args = icrc_ledger_types::icrc1::transfer::TransferArg {
            from_subaccount,
            to,
            amount: Nat::from(amount),
            fee: None,
            memo: None,
            created_at_time: Some(created_at_time),
        };

        let response = ic_cdk::call::Call::unbounded_wait(ledger, "icrc1_transfer")
            .with_arg(&args)
            .await
            .map_err(|e| {
                VolumetricError::inter_canister_call_failed(&format!("icrc1_transfer: {:?}", e))
            })?;

        let result: Result<Nat, TransferError> = response.candid().map_err(|e| {
            VolumetricError::inter_canister_call_failed(&format!("icrc1_transfer decode: {:?}", e))
        })?;

        match result {
            Ok(block_index) => Ok(block_index.0.try_into().unwrap_or(0)),
            Err(TransferError::Duplicate { duplicate_of }) => {
                Ok(duplicate_of.0.try_into().unwrap_or(0))
            }
            Err(e) => Err(VolumetricError::inter_canister_call_failed(&format!(
                "icrc1_transfer rejected: {:?}",
                e
            ))),
        }
    }

    async fn icrc1_balance_of(&self, account: Account) -> Result<Nat, VolumetricError> {
        let ledger = Config::ckbtc_ledger();

        let response = ic_cdk::call::Call::unbounded_wait(ledger, "icrc1_balance_of")
            .with_arg(account)
            .await
            .map_err(|e| {
                VolumetricError::inter_canister_call_failed(&format!("icrc1_balance_of: {:?}", e))
            })?;

        let balance: Nat = response.candid().map_err(|e| {
            VolumetricError::inter_canister_call_failed(&format!(
                "icrc1_balance_of decode: {:?}",
                e
            ))
        })?;

        Ok(balance)
    }

    async fn icrc2_approve(&self, args: ApproveArgs) -> Result<Nat, VolumetricError> {
        let ledger = Config::ckbtc_ledger();

        let response = ic_cdk::call::Call::unbounded_wait(ledger, "icrc2_approve")
            .with_arg(&args)
            .await
            .map_err(|e| {
                VolumetricError::inter_canister_call_failed(&format!("icrc2_approve: {:?}", e))
            })?;

        let result: Result<Nat, ApproveError> = response.candid().map_err(|e| {
            VolumetricError::inter_canister_call_failed(&format!("icrc2_approve decode: {:?}", e))
        })?;

        match result {
            Ok(block_index) => Ok(block_index),
            Err(ApproveError::Duplicate { duplicate_of: _ }) => Ok(Nat::from(0u64)),
            Err(e) => Err(VolumetricError::inter_canister_call_failed(&format!(
                "icrc2_approve rejected: {:?}",
                e
            ))),
        }
    }
}

pub async fn icrc1_transfer(
    from_subaccount: Option<[u8; 32]>,
    to: Account,
    amount: u64,
    created_at_time: u64,
) -> Result<u64, VolumetricError> {
    IcLedger
        .icrc1_transfer(from_subaccount, to, amount, created_at_time)
        .await
}

pub async fn icrc1_balance_of(account: Account) -> Result<Nat, VolumetricError> {
    IcLedger.icrc1_balance_of(account).await
}

pub async fn icrc2_approve(args: ApproveArgs) -> Result<Nat, VolumetricError> {
    IcLedger.icrc2_approve(args).await
}
