use icrc_ledger_types::icrc1::account::Account;
use icrc_ledger_types::icrc1::transfer::Memo;

use crate::errors::VolumetricError;
use crate::ledger;

pub async fn transfer_ckbtc(
    from_subaccount: Option<[u8; 32]>,
    to: Account,
    amount: u64,
    created_at_time_ns: u64,
    memo: Option<Memo>,
) -> Result<u64, VolumetricError> {
    ledger::icrc1_transfer(from_subaccount, to, amount, created_at_time_ns, memo).await
}
