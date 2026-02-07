use candid::{Nat, Principal};
use icrc_ledger_types::icrc1::account::Account;

use crate::auth::derive_subaccount;
use crate::errors::VolumetricError;
use crate::generated::ckbtc::RetrieveBtcWithApprovalArgs;
use crate::locks::WithdrawalLock;
use crate::storage::{
    add_available, complete_withdrawal, create_withdrawal, emit_event, fail_withdrawal,
    remove_withdrawal, subtract_available, update_withdrawal_phase, Config, EventData, EventType,
    WithdrawalPhase,
};
use crate::{ic, ledger, minter};

pub struct WithdrawParams {
    pub btc_address: String,
    pub amount: u64,
}

pub struct WithdrawResult {
    pub block_index: u64,
}

pub async fn withdraw_ckbtc_use_case(
    principal: Principal,
    params: WithdrawParams,
) -> Result<WithdrawResult, VolumetricError> {
    // bind to _lock, not `let _ =` which drops immediately
    let _lock = WithdrawalLock::new(principal)?;

    subtract_available(principal, params.amount)
        .map_err(|e| VolumetricError::insufficient_balance(e.available, e.required))?;

    let subaccount = derive_subaccount(principal);
    let minter = Config::ckbtc_minter();
    let created_at_time = ic::time();

    let withdrawal = create_withdrawal(
        principal,
        params.amount,
        params.btc_address.clone(),
        created_at_time,
    );
    let withdrawal_id = withdrawal.id;

    let approve_args = icrc_ledger_types::icrc2::approve::ApproveArgs {
        from_subaccount: Some(subaccount),
        spender: Account {
            owner: minter,
            subaccount: None,
        },
        amount: Nat::from(params.amount),
        expected_allowance: None,
        expires_at: None,
        fee: None,
        memo: None,
        created_at_time: Some(created_at_time),
    };

    if let Err(e) = ledger::icrc2_approve(approve_args).await {
        add_available(principal, params.amount);
        fail_withdrawal(withdrawal_id, format!("icrc2_approve failed: {:?}", e));
        return Err(e);
    }

    update_withdrawal_phase(withdrawal_id, WithdrawalPhase::Approved);

    let btc_address = params.btc_address.clone();
    let retrieve_args = RetrieveBtcWithApprovalArgs {
        address: params.btc_address,
        amount: params.amount,
        from_subaccount: Some(serde_bytes::ByteBuf::from(subaccount.to_vec())),
    };

    match minter::retrieve_btc_with_approval(retrieve_args).await {
        Ok(ok) => {
            update_withdrawal_phase(
                withdrawal_id,
                WithdrawalPhase::RetrieveRequested {
                    block_index: ok.block_index,
                },
            );
            complete_withdrawal(withdrawal_id, ok.block_index);
            remove_withdrawal(withdrawal_id);

            emit_event(
                principal,
                EventType::Withdrawal,
                EventData::Withdrawal {
                    amount_sats: params.amount,
                    destination: btc_address,
                },
            );

            Ok(WithdrawResult {
                block_index: ok.block_index,
            })
        }
        Err(e) => {
            add_available(principal, params.amount);
            let reason = format!("retrieve_btc_with_approval failed: {:?}", e);
            fail_withdrawal(withdrawal_id, reason.clone());

            emit_event(
                principal,
                EventType::WithdrawalFailed,
                EventData::WithdrawalFailed {
                    amount_sats: params.amount,
                    reason,
                },
            );

            Err(e)
        }
    }
}
