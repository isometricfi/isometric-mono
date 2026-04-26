use candid::Principal;
use icrc_ledger_types::icrc1::transfer::Memo;
use sha2::{Digest, Sha256};

use super::OperationId;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum LedgerMemoKind {
    AcceptWriterTransfer,
    AcceptPlatformFee,
    SettlementBuyerPayout,
    SettlementProfitFee,
    WithdrawalApprove,
}

impl LedgerMemoKind {
    fn as_bytes(self) -> &'static [u8] {
        match self {
            Self::AcceptWriterTransfer => b"accept_writer_transfer",
            Self::AcceptPlatformFee => b"accept_platform_fee",
            Self::SettlementBuyerPayout => b"settlement_buyer_payout",
            Self::SettlementProfitFee => b"settlement_profit_fee",
            Self::WithdrawalApprove => b"withdrawal_approve",
        }
    }
}

pub fn ledger_memo(operation_id: OperationId, kind: LedgerMemoKind, extra_parts: &[&[u8]]) -> Memo {
    let mut hasher = Sha256::new();
    update_part(&mut hasher, b"volumetric-ledger-memo-v1");
    update_part(&mut hasher, &operation_id.0);
    update_part(&mut hasher, kind.as_bytes());
    for part in extra_parts {
        update_part(&mut hasher, part);
    }
    Memo::from(hasher.finalize().to_vec())
}

pub fn principal_memo_part(principal: Principal) -> Vec<u8> {
    principal.as_slice().to_vec()
}

pub fn u64_memo_part(value: u64) -> [u8; 8] {
    value.to_be_bytes()
}

fn update_part(hasher: &mut Sha256, part: &[u8]) {
    hasher.update((part.len() as u64).to_be_bytes());
    hasher.update(part);
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Given: the same operation and side-effect inputs
    /// When: building ledger memos repeatedly
    /// Then: the memo bytes are deterministic
    #[test]
    fn ledger_memo_is_deterministic_for_same_inputs() {
        // given
        let operation_id = OperationId::from_parts(&[b"accept", &[1]]);
        let writer = principal_memo_part(Principal::from_slice(&[7; 29]));

        // when
        let first = ledger_memo(
            operation_id,
            LedgerMemoKind::AcceptWriterTransfer,
            &[&writer],
        );
        let second = ledger_memo(
            operation_id,
            LedgerMemoKind::AcceptWriterTransfer,
            &[&writer],
        );

        // then
        assert_eq!(first, second);
    }

    /// Given: the same operation but different side-effect phases
    /// When: building ledger memos
    /// Then: each phase gets a distinct memo
    #[test]
    fn ledger_memo_differs_by_side_effect_kind() {
        // given
        let operation_id = OperationId::from_parts(&[b"settlement", &[1]]);

        // when
        let buyer_payout = ledger_memo(operation_id, LedgerMemoKind::SettlementBuyerPayout, &[]);
        let profit_fee = ledger_memo(operation_id, LedgerMemoKind::SettlementProfitFee, &[]);

        // then
        assert_ne!(buyer_payout, profit_fee);
    }

    /// Given: the same side-effect phase but different operations
    /// When: building ledger memos
    /// Then: each operation gets a distinct memo
    #[test]
    fn ledger_memo_differs_by_operation_id() {
        // given
        let first_operation_id = OperationId::from_parts(&[b"settlement", &[1]]);
        let second_operation_id = OperationId::from_parts(&[b"settlement", &[2]]);

        // when
        let first = ledger_memo(
            first_operation_id,
            LedgerMemoKind::SettlementBuyerPayout,
            &[],
        );
        let second = ledger_memo(
            second_operation_id,
            LedgerMemoKind::SettlementBuyerPayout,
            &[],
        );

        // then
        assert_ne!(first, second);
    }
}
