import type { Account, AuditExpectedTransfer, OptionAuditReport } from "@volumetric/canister-types";

import { accountKey, type LedgerAccount } from "./account";
import type { AccountTransaction } from "./ckbtc-index";
import { bytesToHex, principalText } from "./format";

export type TransferMatchStatus = "matched" | "missing" | "ambiguous";

export type ExpectedTransferAuditRow = {
  key: string;
  kind: string;
  amountSats: bigint;
  from: LedgerAccount;
  to: LedgerAccount;
  memoHex: string;
  matchedTransactionIds: bigint[];
  status: TransferMatchStatus;
  note: string;
};

export function buildExpectedTransferRows(
  report: OptionAuditReport,
  transactions: AccountTransaction[],
): ExpectedTransferAuditRow[] {
  return report.expected_transfers
    .filter((expectedTransfer) => expectedTransfer.memo.length > 0)
    .map((expectedTransfer, expectedTransferIndex) => {
      const matchedTransactionIds = transactions
        .filter((transaction) =>
          doesTransactionMatchExpectedTransfer(transaction, expectedTransfer),
        )
        .map((transaction) => transaction.id);

      return {
        key: `${variantName(expectedTransfer.kind)}-${expectedTransferIndex}`,
        kind: variantName(expectedTransfer.kind),
        amountSats: expectedTransfer.amount_sats,
        from: toLedgerAccount(expectedTransfer.from),
        to: toLedgerAccount(expectedTransfer.to),
        memoHex: bytesToHex(expectedTransfer.memo),
        matchedTransactionIds,
        status: getMatchStatus(matchedTransactionIds),
        note: expectedTransfer.note,
      };
    });
}

export function sumIncomingTransfers({
  transactions,
  toOwner,
  fromOwners,
}: {
  transactions: AccountTransaction[];
  toOwner: string;
  fromOwners: string[];
}): bigint {
  const allowedFromOwners = new Set(fromOwners);

  return transactions.reduce((total, accountTransaction) => {
    const transfer = accountTransaction.transaction.transfer[0];
    if (!transfer) {
      return total;
    }

    const isToOwner = transfer.to.owner.toText() === toOwner;
    const isFromKnownOwner = allowedFromOwners.has(transfer.from.owner.toText());
    if (!isToOwner || !isFromKnownOwner) {
      return total;
    }

    return total + transfer.amount;
  }, 0n);
}

function doesTransactionMatchExpectedTransfer(
  accountTransaction: AccountTransaction,
  expectedTransfer: AuditExpectedTransfer,
): boolean {
  const transfer = accountTransaction.transaction.transfer[0];
  if (!transfer) {
    return false;
  }

  const expectedMemoHex = bytesToHex(expectedTransfer.memo);
  const transferMemo = transfer.memo[0];
  const transferMemoHex = transferMemo ? bytesToHex(transferMemo) : "";

  return (
    transfer.amount === expectedTransfer.amount_sats &&
    accountKey(transfer.from) === accountKey(toLedgerAccount(expectedTransfer.from)) &&
    accountKey(transfer.to) === accountKey(toLedgerAccount(expectedTransfer.to)) &&
    transferMemoHex === expectedMemoHex
  );
}

export function toLedgerAccount(account: Account): LedgerAccount {
  return {
    owner: account.owner,
    subaccount: account.subaccount[0] ? [new Uint8Array(account.subaccount[0])] : [],
  };
}

function getMatchStatus(matchedTransactionIds: bigint[]): TransferMatchStatus {
  if (matchedTransactionIds.length === 0) {
    return "missing";
  }

  if (matchedTransactionIds.length === 1) {
    return "matched";
  }

  return "ambiguous";
}

function variantName(variant: Record<string, unknown>): string {
  return Object.keys(variant)[0] ?? "Unknown";
}

export function accountLabel(account: LedgerAccount): string {
  const subaccount = account.subaccount[0];
  if (!subaccount) {
    return `${principalText(account.owner)} / default`;
  }

  return `${principalText(account.owner)} / ${bytesToHex(subaccount).slice(0, 16)}...`;
}
