use candid::{Nat, Principal};
use icrc_ledger_types::icrc1::account::Account;

use crate::auth::derive_subaccount;
use crate::errors::VolumetricError;
use crate::generated::ckbtc::{GetBtcAddressArg, UpdateBalanceArg, UpdateBalanceError, UtxoStatus};
use crate::storage::{
    add_available, emit_event, get_balance, set_balance, Config, EventData, EventType, UserBalance,
};

pub struct DepositAddressResult {
    pub btc_address: String,
    pub account: Account,
}

fn get_user_subaccount(principal: Principal) -> [u8; 32] {
    derive_subaccount(principal)
}

fn get_user_account(principal: Principal) -> Account {
    let subaccount = get_user_subaccount(principal);
    Account {
        owner: ic_cdk::api::canister_self(),
        subaccount: Some(subaccount),
    }
}

pub async fn get_deposit_address(
    principal: Principal,
) -> Result<DepositAddressResult, VolumetricError> {
    let subaccount = get_user_subaccount(principal);
    let minter = Config::ckbtc_minter();

    let args = GetBtcAddressArg {
        owner: Some(ic_cdk::api::canister_self()),
        subaccount: Some(serde_bytes::ByteBuf::from(subaccount.to_vec())),
    };

    let response = ic_cdk::call::Call::unbounded_wait(minter, "get_btc_address")
        .with_arg(&args)
        .await
        .map_err(|e| {
            VolumetricError::inter_canister_call_failed(&format!("get_btc_address: {:?}", e))
        })?;

    let btc_address: String = response.candid().map_err(|e| {
        VolumetricError::inter_canister_call_failed(&format!("get_btc_address decode: {:?}", e))
    })?;

    let account = get_user_account(principal);
    Ok(DepositAddressResult {
        btc_address,
        account,
    })
}

pub async fn mint_ckbtc_from_utxos(
    principal: Principal,
) -> Result<Vec<UtxoStatus>, VolumetricError> {
    let subaccount = get_user_subaccount(principal);
    let minter = Config::ckbtc_minter();

    let args = UpdateBalanceArg {
        owner: Some(ic_cdk::api::canister_self()),
        subaccount: Some(serde_bytes::ByteBuf::from(subaccount.to_vec())),
    };

    let response = ic_cdk::call::Call::unbounded_wait(minter, "update_balance")
        .with_arg(&args)
        .await
        .map_err(|e| {
            VolumetricError::inter_canister_call_failed(&format!("update_balance: {:?}", e))
        })?;

    let result: Result<Vec<UtxoStatus>, UpdateBalanceError> = response.candid().map_err(|e| {
        VolumetricError::inter_canister_call_failed(&format!("update_balance decode: {:?}", e))
    })?;

    // NoNewUtxos is not an error - it just means no new deposits to process
    let statuses = match result {
        Ok(statuses) => statuses,
        Err(UpdateBalanceError::NoNewUtxos { .. }) => vec![],
        Err(e) => {
            let msg = match e {
                UpdateBalanceError::GenericError { error_message, .. } => error_message,
                UpdateBalanceError::TemporarilyUnavailable(msg) => msg,
                UpdateBalanceError::AlreadyProcessing => "Already processing".to_string(),
                UpdateBalanceError::NoNewUtxos { .. } => unreachable!(),
            };
            return Err(VolumetricError::inter_canister_call_failed(&format!(
                "update_balance: {}",
                msg
            )));
        }
    };

    let total_minted: u64 = statuses
        .iter()
        .filter_map(|s| match s {
            UtxoStatus::Minted { minted_amount, .. } => Some(*minted_amount),
            _ => None,
        })
        .sum();

    if total_minted > 0 {
        add_available(principal, total_minted);
        emit_event(
            principal,
            EventType::Deposit,
            EventData::Deposit {
                amount_sats: total_minted,
            },
        );
    }

    Ok(statuses)
}

pub async fn get_ledger_balance(principal: Principal) -> Result<Nat, VolumetricError> {
    let account = get_user_account(principal);
    let ledger = Config::ckbtc_ledger();

    let response = ic_cdk::call::Call::unbounded_wait(ledger, "icrc1_balance_of")
        .with_arg(account)
        .await
        .map_err(|e| {
            VolumetricError::inter_canister_call_failed(&format!("icrc1_balance_of: {:?}", e))
        })?;

    let balance: Nat = response.candid().map_err(|e| {
        VolumetricError::inter_canister_call_failed(&format!("icrc1_balance_of decode: {:?}", e))
    })?;

    Ok(balance)
}

pub async fn sync_balance_from_ledger(principal: Principal) -> Result<u64, VolumetricError> {
    let account = get_user_account(principal);
    let ledger = Config::ckbtc_ledger();

    let response = ic_cdk::call::Call::unbounded_wait(ledger, "icrc1_balance_of")
        .with_arg(account)
        .await
        .map_err(|e| {
            VolumetricError::inter_canister_call_failed(&format!("icrc1_balance_of: {:?}", e))
        })?;

    let balance: Nat = response.candid().map_err(|e| {
        VolumetricError::inter_canister_call_failed(&format!("icrc1_balance_of decode: {:?}", e))
    })?;

    let balance_u64: u64 = balance
        .0
        .try_into()
        .map_err(|_| VolumetricError::internal("Balance too large to fit in u64"))?;

    let existing_balance = get_balance(&principal);
    let reconciled_balance = reconcile_user_balance(balance_u64, existing_balance)?;
    set_balance(principal, reconciled_balance);

    Ok(balance_u64)
}

fn reconcile_user_balance(
    ledger_balance: u64,
    existing_balance: UserBalance,
) -> Result<UserBalance, VolumetricError> {
    if ledger_balance < existing_balance.locked_as_writer {
        return Err(VolumetricError::config_error(
            "Ledger balance below locked collateral",
        ));
    }

    Ok(UserBalance {
        available: ledger_balance.saturating_sub(existing_balance.locked_as_writer),
        locked_as_writer: existing_balance.locked_as_writer,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_reconcile_user_balance_preserves_locked_collateral() {
        // given
        const LEDGER_BALANCE: u64 = 10_000;
        const LOCKED_BALANCE: u64 = 4_000;
        let existing = UserBalance {
            available: 6_000,
            locked_as_writer: LOCKED_BALANCE,
        };

        // when
        let result = reconcile_user_balance(LEDGER_BALANCE, existing).expect("Reconcile failed");

        // then
        const EXPECTED_AVAILABLE: u64 = 6_000;
        assert_eq!(result.available, EXPECTED_AVAILABLE);
        assert_eq!(result.locked_as_writer, LOCKED_BALANCE);
    }

    #[test]
    fn test_reconcile_user_balance_rejects_ledger_under_locked() {
        // given
        const LEDGER_BALANCE: u64 = 3_000;
        const LOCKED_BALANCE: u64 = 4_000;
        let existing = UserBalance {
            available: 1_000,
            locked_as_writer: LOCKED_BALANCE,
        };

        // when
        let result = reconcile_user_balance(LEDGER_BALANCE, existing);

        // then
        assert!(result.is_err());
    }
}
