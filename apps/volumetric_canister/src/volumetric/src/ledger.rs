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

use crate::errors::{error_codes, VolumetricError};
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

fn nat_to_u64_or_error(value: Nat, context: &str) -> Result<u64, VolumetricError> {
    value.0.try_into().map_err(|_| {
        VolumetricError::from_def(
            error_codes::INTER_CANISTER_CALL_FAILED,
            Some(&format!("{}: block index does not fit into u64", context)),
            None,
        )
    })
}

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

        let response = ic_cdk::call::Call::bounded_wait(ledger, "icrc1_transfer")
            .with_arg(&args)
            .await
            .map_err(|e| {
                VolumetricError::from_def(
                    error_codes::INTER_CANISTER_CALL_FAILED,
                    Some(&format!("icrc1_transfer (bounded_wait): {:?}", e)),
                    None,
                )
            })?;

        let result: Result<Nat, TransferError> = response.candid().map_err(|e| {
            VolumetricError::from_def(
                error_codes::INTER_CANISTER_CALL_FAILED,
                Some(&format!("icrc1_transfer decode: {:?}", e)),
                None,
            )
        })?;

        match result {
            Ok(block_index) => nat_to_u64_or_error(block_index, "icrc1_transfer"),
            Err(TransferError::Duplicate { duplicate_of }) => {
                nat_to_u64_or_error(duplicate_of, "icrc1_transfer duplicate")
            }
            Err(e) => Err(VolumetricError::from_def(
                error_codes::INTER_CANISTER_CALL_FAILED,
                Some(&format!("icrc1_transfer rejected: {:?}", e)),
                None,
            )),
        }
    }

    async fn icrc1_balance_of(&self, account: Account) -> Result<Nat, VolumetricError> {
        let ledger = Config::ckbtc_ledger();

        let response = ic_cdk::call::Call::bounded_wait(ledger, "icrc1_balance_of")
            .with_arg(account)
            .await
            .map_err(|e| {
                VolumetricError::from_def(
                    error_codes::INTER_CANISTER_CALL_FAILED,
                    Some(&format!("icrc1_balance_of (bounded_wait): {:?}", e)),
                    None,
                )
            })?;

        let balance: Nat = response.candid().map_err(|e| {
            VolumetricError::from_def(
                error_codes::INTER_CANISTER_CALL_FAILED,
                Some(&format!("icrc1_balance_of decode: {:?}", e)),
                None,
            )
        })?;

        Ok(balance)
    }

    async fn icrc2_approve(&self, args: ApproveArgs) -> Result<Nat, VolumetricError> {
        let ledger = Config::ckbtc_ledger();

        let response = ic_cdk::call::Call::bounded_wait(ledger, "icrc2_approve")
            .with_arg(&args)
            .await
            .map_err(|e| {
                VolumetricError::from_def(
                    error_codes::INTER_CANISTER_CALL_FAILED,
                    Some(&format!("icrc2_approve (bounded_wait): {:?}", e)),
                    None,
                )
            })?;

        let result: Result<Nat, ApproveError> = response.candid().map_err(|e| {
            VolumetricError::from_def(
                error_codes::INTER_CANISTER_CALL_FAILED,
                Some(&format!("icrc2_approve decode: {:?}", e)),
                None,
            )
        })?;

        match result {
            Ok(block_index) => Ok(block_index),
            Err(ApproveError::Duplicate { duplicate_of: _ }) => Ok(Nat::from(0u64)),
            Err(e) => Err(VolumetricError::from_def(
                error_codes::INTER_CANISTER_CALL_FAILED,
                Some(&format!("icrc2_approve rejected: {:?}", e)),
                None,
            )),
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_nat_to_u64_or_error_rejects_overflowing_value() {
        // given
        let overflowing_value = Nat::from(u128::MAX);

        // when
        let result = nat_to_u64_or_error(overflowing_value, "overflow test");

        // then
        assert!(result.is_err());
        let error = result.unwrap_err();
        assert_eq!(error.code, error_codes::INTER_CANISTER_CALL_FAILED.code);
    }

    #[test]
    fn test_nat_to_u64_or_error_accepts_u64_value() {
        // given
        let in_range_value = Nat::from(42u64);

        // when
        let result = nat_to_u64_or_error(in_range_value, "in-range test");

        // then
        assert!(result.is_ok());
        assert_eq!(result.expect("value should convert to u64"), 42);
    }
}
