"use client";

export type PendingWithdrawalStatus = "broadcasting" | "pending";

export interface PendingWithdrawal {
  operationId: string;
  destinationAddress: string;
  amountSats: number;
  bitcoinTxid: string | null;
  confirmations: number;
  status: PendingWithdrawalStatus;
  createdAtMs: number;
}

export function usePendingWithdrawals() {
  return {
    withdrawals: [] as PendingWithdrawal[],
    isLoading: false,
    hasPending: false,
  };
}
