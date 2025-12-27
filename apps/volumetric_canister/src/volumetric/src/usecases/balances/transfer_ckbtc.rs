use candid::Nat;
use icrc_ledger_types::icrc1::account::Account;
use icrc_ledger_types::icrc1::transfer::TransferError;

use crate::errors::VolumetricError;
use crate::storage::Config;

pub async fn transfer_ckbtc(
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
