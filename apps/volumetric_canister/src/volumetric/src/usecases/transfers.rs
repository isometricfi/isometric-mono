use candid::Nat;
use icrc_ledger_types::icrc1::account::Account;

use crate::errors::VolumetricError;
use crate::storage::Config;

pub async fn transfer_ckbtc(
    from_subaccount: Option<[u8; 32]>,
    to: Account,
    amount: u64,
) -> Result<(), VolumetricError> {
    let ledger = Config::ckbtc_ledger();

    let args = icrc_ledger_types::icrc1::transfer::TransferArg {
        from_subaccount,
        to,
        amount: Nat::from(amount),
        fee: None,
        memo: None,
        created_at_time: None,
    };

    let response = ic_cdk::call::Call::unbounded_wait(ledger, "icrc1_transfer")
        .with_arg(&args)
        .await
        .map_err(|e| {
            VolumetricError::inter_canister_call_failed(&format!("icrc1_transfer: {:?}", e))
        })?;

    let result: Result<Nat, icrc_ledger_types::icrc1::transfer::TransferError> =
        response.candid().map_err(|e| {
            VolumetricError::inter_canister_call_failed(&format!("icrc1_transfer decode: {:?}", e))
        })?;

    result.map_err(|e| {
        VolumetricError::inter_canister_call_failed(&format!("icrc1_transfer rejected: {:?}", e))
    })?;

    Ok(())
}
