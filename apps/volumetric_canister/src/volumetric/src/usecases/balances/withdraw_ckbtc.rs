use candid::{Nat, Principal};
use icrc_ledger_types::icrc1::account::Account;
use icrc_ledger_types::icrc2::approve::ApproveError;

use crate::auth::derive_subaccount;
use crate::errors::VolumetricError;
use crate::generated::ckbtc::{
    RetrieveBtcOk, RetrieveBtcWithApprovalArgs, RetrieveBtcWithApprovalError,
};
use crate::locks::WithdrawalLock;
use crate::storage::{
    add_available, complete_withdrawal, create_withdrawal, emit_event, fail_withdrawal,
    remove_withdrawal, subtract_available, update_withdrawal_phase, Config, EventData, EventType,
    WithdrawalPhase,
};

pub struct WithdrawParams {
    pub btc_address: String,
    pub amount: u64,
}

pub struct WithdrawResult {
    pub block_index: u64,
}

fn should_refund_after_retrieve_failure(
    is_unknown_outcome: bool,
    approval_revoked: bool,
) -> bool {
    !is_unknown_outcome && approval_revoked
}

async fn revoke_withdraw_approval(
    ledger: Principal,
    minter: Principal,
    subaccount: [u8; 32],
) -> Result<(), VolumetricError> {
    let revoke_args = icrc_ledger_types::icrc2::approve::ApproveArgs {
        from_subaccount: Some(subaccount),
        spender: Account {
            owner: minter,
            subaccount: None,
        },
        amount: Nat::from(0u64),
        expected_allowance: None,
        expires_at: None,
        fee: None,
        memo: None,
        created_at_time: None,
    };

    let response = ic_cdk::call::Call::unbounded_wait(ledger, "icrc2_approve")
        .with_arg(&revoke_args)
        .await
        .map_err(|e| {
            VolumetricError::inter_canister_call_failed(&format!("revoke icrc2_approve: {:?}", e))
        })?;

    let result: Result<Nat, ApproveError> = response.candid().map_err(|e| {
        VolumetricError::inter_canister_call_failed(&format!("revoke decode: {:?}", e))
    })?;

    match result {
        Ok(_) | Err(ApproveError::Duplicate { .. }) => Ok(()),
        Err(e) => Err(VolumetricError::inter_canister_call_failed(&format!(
            "revoke rejected: {:?}",
            e
        ))),
    }
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
    let ledger = Config::ckbtc_ledger();
    let created_at_time = ic_cdk::api::time();

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

    let approve_response = ic_cdk::call::Call::unbounded_wait(ledger, "icrc2_approve")
        .with_arg(&approve_args)
        .await;

    if let Err(e) = approve_response {
        add_available(principal, params.amount);
        fail_withdrawal(withdrawal_id, format!("icrc2_approve call failed: {:?}", e));
        return Err(VolumetricError::inter_canister_call_failed(&format!(
            "icrc2_approve: {:?}",
            e
        )));
    }

    let approve_result: Result<Nat, ApproveError> =
        approve_response.unwrap().candid().map_err(|e| {
            add_available(principal, params.amount);
            fail_withdrawal(
                withdrawal_id,
                format!("icrc2_approve decode failed: {:?}", e),
            );
            VolumetricError::inter_canister_call_failed(&format!("icrc2_approve decode: {:?}", e))
        })?;

    match approve_result {
        Ok(_) => {}
        Err(ApproveError::Duplicate { duplicate_of: _ }) => {}
        Err(e) => {
            add_available(principal, params.amount);
            fail_withdrawal(withdrawal_id, format!("icrc2_approve rejected: {:?}", e));
            return Err(VolumetricError::inter_canister_call_failed(&format!(
                "icrc2_approve rejected: {:?}",
                e
            )));
        }
    }

    update_withdrawal_phase(withdrawal_id, WithdrawalPhase::Approved);

    let btc_address = params.btc_address.clone();
    let retrieve_args = RetrieveBtcWithApprovalArgs {
        address: params.btc_address,
        amount: params.amount,
        from_subaccount: Some(serde_bytes::ByteBuf::from(subaccount.to_vec())),
    };

    let retrieve_response =
        ic_cdk::call::Call::unbounded_wait(minter, "retrieve_btc_with_approval")
            .with_arg(&retrieve_args)
            .await;

    if let Err(e) = retrieve_response {
        let revoke_result = revoke_withdraw_approval(ledger, minter, subaccount).await;
        let reason = match revoke_result {
            Ok(()) => format!(
                "retrieve_btc_with_approval call failed with unknown outcome: {:?}",
                e
            ),
            Err(revoke_error) => format!(
                "retrieve call failed and approval revoke failed: {:?} / {:?}",
                e, revoke_error
            ),
        };
        fail_withdrawal(withdrawal_id, reason.clone());
        emit_event(
            principal,
            EventType::WithdrawalFailed,
            EventData::WithdrawalFailed {
                amount_sats: params.amount,
                reason,
            },
        );
        return Err(VolumetricError::inter_canister_call_failed(&format!(
            "retrieve_btc_with_approval: {:?}",
            e
        )));
    }

    let retrieve_result: Result<RetrieveBtcOk, RetrieveBtcWithApprovalError> =
        match retrieve_response.unwrap().candid() {
            Ok(result) => result,
            Err(e) => {
                let revoke_result = revoke_withdraw_approval(ledger, minter, subaccount).await;
                let reason = match revoke_result {
                    Ok(()) => format!(
                        "retrieve_btc_with_approval decode failed with unknown outcome: {:?}",
                        e
                    ),
                    Err(revoke_error) => format!(
                        "retrieve decode failed and approval revoke failed: {:?} / {:?}",
                        e, revoke_error
                    ),
                };
                fail_withdrawal(withdrawal_id, reason.clone());
                emit_event(
                    principal,
                    EventType::WithdrawalFailed,
                    EventData::WithdrawalFailed {
                        amount_sats: params.amount,
                        reason,
                    },
                );
                return Err(VolumetricError::inter_canister_call_failed(&format!(
                    "retrieve_btc_with_approval decode: {:?}",
                    e
                )));
            }
        };

    match retrieve_result {
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
        Err(_) => {
            let approval_revoked = revoke_withdraw_approval(ledger, minter, subaccount)
                .await
                .is_ok();
            if should_refund_after_retrieve_failure(false, approval_revoked) {
                add_available(principal, params.amount);
            }
            let reason = if approval_revoked {
                "retrieve_btc_with_approval rejected".to_string()
            } else {
                "retrieve_btc_with_approval rejected and approval revoke failed".to_string()
            };
            fail_withdrawal(withdrawal_id, reason.clone());

            emit_event(
                principal,
                EventType::WithdrawalFailed,
                EventData::WithdrawalFailed {
                    amount_sats: params.amount,
                    reason,
                },
            );

            Err(VolumetricError::inter_canister_call_failed(
                "retrieve_btc_with_approval rejected",
            ))
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_rejected_retrieve_refunds_only_after_revoke() {
        // given
        let is_unknown_outcome = false;
        let approval_revoked = true;

        // when
        let should_refund =
            should_refund_after_retrieve_failure(is_unknown_outcome, approval_revoked);

        // then
        assert!(should_refund);
    }

    #[test]
    fn test_unknown_retrieve_outcome_never_refunds_immediately() {
        // given
        let is_unknown_outcome = true;
        let approval_revoked = true;

        // when
        let should_refund =
            should_refund_after_retrieve_failure(is_unknown_outcome, approval_revoked);

        // then
        assert!(!should_refund);
    }
}
