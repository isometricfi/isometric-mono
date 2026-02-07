/// Wraps ckBTC ledger inter-canister calls behind a swappable implementation.
///
/// - Production: calls go through [`IcLedger`] → `ic_cdk` inter-canister calls.
/// - Tests: call [`set_ledger`] to swap in a mock. `set_ledger` is
///   `#[cfg(test)]` so it doesn't exist in the production binary.
use std::cell::RefCell;
use std::rc::Rc;

use async_trait::async_trait;
use candid::Nat;
use icrc_ledger_types::icrc1::account::Account;
use icrc_ledger_types::icrc1::transfer::TransferError;
use icrc_ledger_types::icrc2::approve::{ApproveArgs, ApproveError};

use crate::errors::VolumetricError;
use crate::storage::Config;

#[async_trait(?Send)]
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

/// Production implementation — delegates to ckBTC ledger via `ic_cdk`.
struct IcLedger;

#[async_trait(?Send)]
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

thread_local! {
    static LEDGER: RefCell<Rc<dyn LedgerClient>> = RefCell::new(Rc::new(IcLedger));
}

pub async fn icrc1_transfer(
    from_subaccount: Option<[u8; 32]>,
    to: Account,
    amount: u64,
    created_at_time: u64,
) -> Result<u64, VolumetricError> {
    let ledger = LEDGER.with(|l| Rc::clone(&l.borrow()));
    ledger
        .icrc1_transfer(from_subaccount, to, amount, created_at_time)
        .await
}

pub async fn icrc1_balance_of(account: Account) -> Result<Nat, VolumetricError> {
    let ledger = LEDGER.with(|l| Rc::clone(&l.borrow()));
    ledger.icrc1_balance_of(account).await
}

pub async fn icrc2_approve(args: ApproveArgs) -> Result<Nat, VolumetricError> {
    let ledger = LEDGER.with(|l| Rc::clone(&l.borrow()));
    ledger.icrc2_approve(args).await
}

/// Swap the ledger implementation (test-only, compiled out in production).
#[cfg(test)]
pub fn set_ledger(client: Rc<dyn LedgerClient>) {
    LEDGER.with(|l| *l.borrow_mut() = client);
}
