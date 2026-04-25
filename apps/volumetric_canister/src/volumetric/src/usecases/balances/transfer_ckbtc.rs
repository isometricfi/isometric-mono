use icrc_ledger_types::icrc1::account::Account;

use crate::errors::VolumetricError;
use crate::ledger;

pub async fn transfer_ckbtc(
    from_subaccount: Option<[u8; 32]>,
    to: Account,
    amount: u64,
    created_at_time_ns: u64,
) -> Result<u64, VolumetricError> {
    ledger::icrc1_transfer(from_subaccount, to, amount, created_at_time_ns).await
}
