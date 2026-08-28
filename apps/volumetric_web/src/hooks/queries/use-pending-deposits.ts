"use client";

import type { fetchAddressTransactions } from "@/lib/mempool-client-browser";

const REQUIRED_CONFIRMATIONS = 4;

export type PendingDepositStatus = "unconfirmed" | "confirming" | "processing";

export interface PendingDeposit {
  txid: string;
  vout: number;
  valueSats: number;
  confirmations: number;
  status: PendingDepositStatus;
}

function getBackendPendingStatus(confirmations: number): PendingDepositStatus {
  if (confirmations < REQUIRED_CONFIRMATIONS) {
    return "confirming";
  }

  return "processing";
}

interface ServerPendingDepositRow {
  txid: string;
  vout: number;
  valueSats: number;
  confirmations: number;
}

interface BuildPendingDepositsParams {
  mempoolTxs: Awaited<ReturnType<typeof fetchAddressTransactions>>;
  serverPendingDeposits: ServerPendingDepositRow[];
  depositAddress: string | null;
}

export function buildPendingDeposits(params: BuildPendingDepositsParams): PendingDeposit[] {
  const { mempoolTxs, serverPendingDeposits, depositAddress } = params;
  const result: PendingDeposit[] = [];

  if (depositAddress) {
    // process unconfirmed mempool transactions detected for the deposit address
    for (const tx of mempoolTxs) {
      const outputs = tx.vout ?? [];
      for (let voutIndex = 0; voutIndex < outputs.length; voutIndex++) {
        const output = outputs[voutIndex];
        if (output.scriptpubkey_address !== depositAddress || !output.value) continue;

        result.push({
          txid: tx.txid,
          vout: voutIndex,
          valueSats: output.value,
          confirmations: 0,
          status: "unconfirmed",
        });
      }
    }
  }

  // add server tracked pending deposits (confirmed, not yet credited)
  for (const deposit of serverPendingDeposits) {
    result.push({
      txid: deposit.txid,
      vout: deposit.vout,
      valueSats: deposit.valueSats,
      confirmations: deposit.confirmations,
      status: getBackendPendingStatus(deposit.confirmations),
    });
  }

  // by confirmations ascending
  result.sort((a, b) => a.confirmations - b.confirmations);

  return result;
}

export function usePendingDeposits() {
  return {
    deposits: [] as PendingDeposit[],
    isLoading: false,
    hasPending: false,
  };
}
