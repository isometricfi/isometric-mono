"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { fetchAddressTransactions, MempoolAddressTracker } from "@/lib/mempool-client-browser";
import { useTRPC } from "@/trpc/react";
import { useBtcAddress } from "./use-btc-address";
import { useDepositAddress } from "./use-deposit-address";

const DEPOSIT_ADDRESS_CACHE_PREFIX = "deposit-address-cache";
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

function getDepositAddressCacheKey(userAddress: string): string {
  return `${DEPOSIT_ADDRESS_CACHE_PREFIX}:${userAddress}`;
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
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const userAddress = useBtcAddress("payment");
  const { data: depositAddressData } = useDepositAddress();
  const depositAddressFromServer = depositAddressData?.btcAddress ?? null;
  const [cachedDepositAddress, setCachedDepositAddress] = useState<string | null>(null);
  const depositAddress = depositAddressFromServer ?? cachedDepositAddress;

  const enabled = !!depositAddress;

  useEffect(() => {
    if (!userAddress) {
      setCachedDepositAddress(null);
      return;
    }

    const cacheKey = getDepositAddressCacheKey(userAddress);
    const cachedValue = window.localStorage.getItem(cacheKey);
    setCachedDepositAddress(cachedValue);
  }, [userAddress]);

  useEffect(() => {
    if (!userAddress || !depositAddressFromServer) {
      return;
    }

    const cacheKey = getDepositAddressCacheKey(userAddress);
    window.localStorage.setItem(cacheKey, depositAddressFromServer);
    setCachedDepositAddress(depositAddressFromServer);
  }, [userAddress, depositAddressFromServer]);

  const mempoolTxQuery = useQuery({
    queryKey: ["mempool", "address-txs-mempool", depositAddress],
    queryFn: () => fetchAddressTransactions(depositAddress!),
    enabled,
    refetchInterval: 30_000,
    staleTime: 10_000,
  });

  const serverPendingQuery = useQuery({
    ...trpc.account.getPendingDeposits.queryOptions({
      address: userAddress ?? "",
    }),
    enabled: !!userAddress,
    refetchInterval: 15_000,
  });

  const trackerRef = useRef<MempoolAddressTracker | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const tracker = new MempoolAddressTracker(depositAddress!, {
      onTransaction: () => {
        queryClient.invalidateQueries({
          queryKey: ["mempool", "address-txs-mempool", depositAddress],
        });
      },
      onBlockHeight: () => {
        queryClient.invalidateQueries({
          queryKey: ["mempool", "address-txs-mempool", depositAddress],
        });
      },
    });

    tracker.connect();
    trackerRef.current = tracker;

    return () => {
      tracker.disconnect();
      trackerRef.current = null;
    };
  }, [enabled, depositAddress, queryClient]);

  const deposits = useMemo<PendingDeposit[]>(() => {
    const mempoolTxs = mempoolTxQuery.data ?? [];
    const serverPendingDeposits = serverPendingQuery.data?.pendingDeposits ?? [];

    return buildPendingDeposits({
      mempoolTxs,
      serverPendingDeposits,
      depositAddress,
    });
  }, [mempoolTxQuery.data, serverPendingQuery.data, depositAddress]);

  return {
    deposits,
    isLoading: mempoolTxQuery.isLoading || serverPendingQuery.isLoading,
    hasPending: deposits.length > 0,
  };
}
