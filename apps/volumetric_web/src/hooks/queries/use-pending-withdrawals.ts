"use client";

import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/react";
import { useBtcAddress } from "./use-btc-address";

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
  const trpc = useTRPC();
  const userAddress = useBtcAddress("payment");

  const query = useQuery({
    ...trpc.account.getPendingWithdrawals.queryOptions({ address: userAddress ?? "" }),
    enabled: !!userAddress,
    refetchInterval: 15_000,
  });

  const withdrawals: PendingWithdrawal[] = query.data?.pendingWithdrawals ?? [];

  return {
    withdrawals,
    isLoading: query.isLoading,
    hasPending: withdrawals.length > 0,
  };
}
