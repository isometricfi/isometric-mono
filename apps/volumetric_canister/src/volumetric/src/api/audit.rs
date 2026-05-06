use candid::{CandidType, Principal};
use icrc_ledger_types::icrc1::transfer::Memo;
use serde::{Deserialize, Serialize};
use serde_bytes::ByteBuf;

use crate::auth::derive_subaccount;
use crate::errors::VolumetricError;
use crate::guards::{is_whitelisted, no_replicated_call};
use crate::ic;
use crate::journaling::{ledger_memo, LedgerMemoKind, OperationId};
use crate::storage::{
    get_active_option, get_all_events, get_balance, get_fee_recipient, get_settlement,
    ActiveOption, Event, EventData, PendingSettlement, TradeRole,
};

const MAX_AUDIT_EVENTS: u32 = 1_000;
const UNKNOWN_LEDGER_CREATED_AT_TIME_NS: u64 = 0;

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
pub enum AuditTransferKind {
    SettlementBuyerPayout,
    SettlementProfitFee,
    InternalCollateralLock,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
pub struct AuditLedgerAccount {
    pub owner: Principal,
    pub subaccount: Option<Vec<u8>>,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
pub struct AuditExpectedTransfer {
    pub kind: AuditTransferKind,
    pub from: AuditLedgerAccount,
    pub to: AuditLedgerAccount,
    pub amount_sats: u64,
    pub created_at_time_ns: u64,
    pub operation_id: OperationId,
    pub memo: Vec<u8>,
    pub note: String,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct AuditUserBalance {
    pub principal: Principal,
    pub available_sats: u64,
    pub locked_as_writer_sats: u64,
    pub total_sats: u64,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct OptionAuditReport {
    pub option_id: u64,
    pub option: Option<ActiveOption>,
    pub settlement: Option<PendingSettlement>,
    pub option_events: Vec<Event>,
    pub buyer_balance: Option<AuditUserBalance>,
    pub writer_balance: Option<AuditUserBalance>,
    pub expected_transfers: Vec<AuditExpectedTransfer>,
}

#[ic_cdk::query(guard = "no_replicated_call")]
pub fn get_option_audit_report(option_id: u64) -> Result<OptionAuditReport, VolumetricError> {
    is_whitelisted()?;

    let option = get_active_option(option_id);
    let settlement = get_settlement(option_id);
    let option_events = list_events_for_option(option_id);
    let buyer = option.as_ref().map(|option| option.buyer);
    let writer = option.as_ref().map(|option| option.writer);

    Ok(OptionAuditReport {
        option_id,
        expected_transfers: option
            .as_ref()
            .map(|option| build_expected_transfers(option, settlement.as_ref(), &option_events))
            .unwrap_or_default(),
        option_events,
        buyer_balance: buyer.map(build_audit_user_balance),
        writer_balance: writer.map(build_audit_user_balance),
        settlement,
        option,
    })
}

fn build_audit_user_balance(principal: Principal) -> AuditUserBalance {
    let balance = get_balance(&principal);
    AuditUserBalance {
        principal,
        available_sats: balance.available,
        locked_as_writer_sats: balance.locked_as_writer,
        total_sats: balance.total(),
    }
}

fn list_events_for_option(option_id: u64) -> Vec<Event> {
    get_all_events(None, MAX_AUDIT_EVENTS)
        .into_iter()
        .filter(|event| event_data_option_id(&event.data) == Some(option_id))
        .collect()
}

fn event_data_option_id(event_data: &EventData) -> Option<u64> {
    match event_data {
        EventData::OfferAccepted { option_id, .. }
        | EventData::OptionSettled { option_id, .. }
        | EventData::OptionSettlementFailed { option_id, .. } => Some(*option_id),
        _ => None,
    }
}

fn build_expected_transfers(
    option: &ActiveOption,
    settlement: Option<&PendingSettlement>,
    option_events: &[Event],
) -> Vec<AuditExpectedTransfer> {
    let mut expected_transfers = Vec::new();
    let canister_account = audit_account(ic::canister_self(), None);
    let writer_subaccount = Some(derive_subaccount(option.writer).to_vec());

    if let Some(settlement_audit_data) = settlement_audit_data(option, settlement, option_events) {
        let settlement_operation_id = settlement_operation_id(option.id);
        if settlement_audit_data.payout_to_buyer_sats > 0 {
            expected_transfers.push(AuditExpectedTransfer {
                kind: AuditTransferKind::SettlementBuyerPayout,
                from: audit_account(ic::canister_self(), writer_subaccount.clone()),
                to: audit_account(
                    ic::canister_self(),
                    Some(derive_subaccount(option.buyer).to_vec()),
                ),
                amount_sats: settlement_audit_data.payout_to_buyer_sats,
                created_at_time_ns: UNKNOWN_LEDGER_CREATED_AT_TIME_NS,
                operation_id: settlement_operation_id,
                memo: memo_to_vec(ledger_memo(
                    settlement_operation_id,
                    LedgerMemoKind::SettlementBuyerPayout,
                    &[],
                )),
                note: settlement_audit_data.source_note.clone(),
            });
        }

        if settlement_audit_data.profit_fee_sats > 0 {
            expected_transfers.push(AuditExpectedTransfer {
                kind: AuditTransferKind::SettlementProfitFee,
                from: audit_account(ic::canister_self(), writer_subaccount),
                to: audit_account(get_fee_recipient(), None),
                amount_sats: settlement_audit_data.profit_fee_sats,
                created_at_time_ns: UNKNOWN_LEDGER_CREATED_AT_TIME_NS,
                operation_id: settlement_operation_id,
                memo: memo_to_vec(ledger_memo(
                    settlement_operation_id,
                    LedgerMemoKind::SettlementProfitFee,
                    &[],
                )),
                note: settlement_audit_data.source_note,
            });
        }
    }

    expected_transfers.push(AuditExpectedTransfer {
        kind: AuditTransferKind::InternalCollateralLock,
        from: canister_account.clone(),
        to: canister_account,
        amount_sats: option.quantity,
        created_at_time_ns: UNKNOWN_LEDGER_CREATED_AT_TIME_NS,
        operation_id: OperationId::from_parts(&[b"readonly-audit", &option.id.to_be_bytes()]),
        memo: Vec::new(),
        note: "Internal accounting reference only; collateral locking is existing canister state, not a ckBTC ledger transfer.".to_string(),
    });

    expected_transfers
}

#[derive(Clone, Debug)]
struct SettlementAuditData {
    payout_to_buyer_sats: u64,
    profit_fee_sats: u64,
    source_note: String,
}

fn settlement_audit_data(
    option: &ActiveOption,
    settlement: Option<&PendingSettlement>,
    option_events: &[Event],
) -> Option<SettlementAuditData> {
    if let Some(settlement) = settlement {
        return Some(SettlementAuditData {
            payout_to_buyer_sats: settlement.payout_to_buyer,
            profit_fee_sats: option
                .quantity
                .saturating_sub(settlement.payout_to_writer)
                .saturating_sub(settlement.payout_to_buyer),
            source_note: "Derived from current settlement journal state.".to_string(),
        });
    }

    let buyer_settled_event = option_events.iter().find_map(|event| match &event.data {
        EventData::OptionSettled {
            payout_sats,
            role: TradeRole::Buyer,
            ..
        } => Some(*payout_sats),
        _ => None,
    });
    let writer_settled_event = option_events.iter().find_map(|event| match &event.data {
        EventData::OptionSettled {
            payout_sats,
            role: TradeRole::Writer,
            ..
        } => Some(*payout_sats),
        _ => None,
    });

    match (buyer_settled_event, writer_settled_event) {
        (Some(payout_to_buyer_sats), Some(payout_to_writer_sats)) => Some(SettlementAuditData {
            payout_to_buyer_sats,
            profit_fee_sats: option
                .quantity
                .saturating_sub(payout_to_writer_sats)
                .saturating_sub(payout_to_buyer_sats),
            source_note: "Derived from existing OptionSettled events.".to_string(),
        }),
        _ => None,
    }
}

fn settlement_operation_id(option_id: u64) -> OperationId {
    OperationId::from_parts(&[b"settlement", &option_id.to_be_bytes()])
}

fn audit_account(owner: Principal, subaccount: Option<Vec<u8>>) -> AuditLedgerAccount {
    AuditLedgerAccount { owner, subaccount }
}

fn memo_to_vec(memo: Memo) -> Vec<u8> {
    let bytes: ByteBuf = memo.into();
    bytes.into_vec()
}
