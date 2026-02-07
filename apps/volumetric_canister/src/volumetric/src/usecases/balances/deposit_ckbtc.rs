use candid::{Nat, Principal};
use icrc_ledger_types::icrc1::account::Account;

use crate::auth::derive_subaccount;
use crate::errors::VolumetricError;
use crate::generated::ckbtc::{GetBtcAddressArg, UpdateBalanceArg, UtxoStatus};
use crate::storage::{add_available, emit_event, set_balance, EventData, EventType, UserBalance};
use crate::{ic, ledger, minter};

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
        owner: ic::canister_self(),
        subaccount: Some(subaccount),
    }
}

pub async fn get_deposit_address(
    principal: Principal,
) -> Result<DepositAddressResult, VolumetricError> {
    let subaccount = get_user_subaccount(principal);

    let args = GetBtcAddressArg {
        owner: Some(ic::canister_self()),
        subaccount: Some(serde_bytes::ByteBuf::from(subaccount.to_vec())),
    };

    let btc_address = minter::get_btc_address(args).await?;

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

    let args = UpdateBalanceArg {
        owner: Some(ic::canister_self()),
        subaccount: Some(serde_bytes::ByteBuf::from(subaccount.to_vec())),
    };

    let statuses = minter::update_balance(args).await?;

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
    ledger::icrc1_balance_of(account).await
}

pub async fn sync_balance_from_ledger(principal: Principal) -> Result<u64, VolumetricError> {
    let account = get_user_account(principal);
    let balance = ledger::icrc1_balance_of(account).await?;

    let balance_u64: u64 = balance
        .0
        .try_into()
        .map_err(|_| VolumetricError::internal("Balance too large to fit in u64"))?;

    set_balance(
        principal,
        UserBalance {
            available: balance_u64,
            locked_as_writer: 0,
        },
    );

    Ok(balance_u64)
}
