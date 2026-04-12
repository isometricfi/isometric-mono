"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef } from "react";
import {
  fetchAddressTransactions,
  fetchTipHeight,
  MempoolAddressTracker,
} from "@/lib/mempool-client-browser";
import { useTRPC } from "@/trpc/react";
import { useBtcAddress } from "./use-btc-address";
import { useDepositAddress } from "./use-deposit-address";

const REQUIRED_CONFIRMATIONS = 4;

export type PendingDepositStatus = "unconfirmed" | "confirming" | "processing";

export interface PendingDeposit {
  txid: string;
  vout: number;
  valueSats: number;
  confirmations: number;
  status: PendingDepositStatus;
}

function getMempoolBaseUrl(): string | null {
  return process.env.NEXT_PUBLIC_MEMPOOL_URL?.trim().replace(/\/$/, "") ?? null;
}

export function usePendingDeposits() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const userAddress = useBtcAddress("payment");
  const { data: depositAddressData } = useDepositAddress();
  const depositAddress = depositAddressData?.btcAddress ?? null;
  const mempoolBaseUrl = getMempoolBaseUrl();

  const enabled = !!depositAddress && !!mempoolBaseUrl;

  const mempoolTxQuery = useQuery({
    queryKey: ["mempool", "address-txs", depositAddress],
    queryFn: () => fetchAddressTransactions(mempoolBaseUrl!, depositAddress!),
    enabled,
    refetchInterval: 30_000,
    staleTime: 10_000,
  });

  const tipHeightQuery = useQuery({
    queryKey: ["mempool", "tip-height"],
    queryFn: () => fetchTipHeight(mempoolBaseUrl!),
    enabled: !!mempoolBaseUrl,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const serverPendingQuery = useQuery({
    ...trpc.account.getPendingDeposits.queryOptions({ address: userAddress ?? "" }),
    enabled: !!userAddress,
    refetchInterval: 15_000,
  });

  const trackerRef = useRef<MempoolAddressTracker | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const tracker = new MempoolAddressTracker(mempoolBaseUrl!, depositAddress!, {
      onTransaction: () => {
        queryClient.invalidateQueries({ queryKey: ["mempool", "address-txs", depositAddress] });
      },
      onBlockHeight: () => {
        queryClient.invalidateQueries({ queryKey: ["mempool", "tip-height"] });
        queryClient.invalidateQueries({ queryKey: ["mempool", "address-txs", depositAddress] });
      },
    });

    tracker.connect();
    trackerRef.current = tracker;

    return () => {
      tracker.disconnect();
      trackerRef.current = null;
    };
  }, [enabled, mempoolBaseUrl, depositAddress, queryClient]);

  const deposits = useMemo<PendingDeposit[]>(() => {
    const tipHeight = tipHeightQuery.data;
    const mempoolTxs = mempoolTxQuery.data ?? [];
    const serverDeposits = serverPendingQuery.data?.pendingDeposits ?? [];
    const serverKeys = new Set(serverDeposits.map((d) => `${d.txid}:${d.vout}`));
    const result: PendingDeposit[] = [];

    // process mempool transactions (0-3 confirmations)
    for (const tx of mempoolTxs) {
      const outputs = tx.vout ?? [];
      for (let voutIndex = 0; voutIndex < outputs.length; voutIndex++) {
        const output = outputs[voutIndex];
        if (output.scriptpubkey_address !== depositAddress || !output.value) continue;

        const isConfirmed = tx.status?.confirmed === true && tx.status.block_height != null;
        const confirmations =
          isConfirmed && tipHeight != null
            ? Math.max(0, tipHeight - tx.status!.block_height! + 1)
            : 0;

        // skip if already tracked by server (server is authoritative for 4+ conf)
        if (serverKeys.has(`${tx.txid}:${voutIndex}`)) continue;

        result.push({
          txid: tx.txid,
          vout: voutIndex,
          valueSats: output.value,
          confirmations,
          status:
            confirmations === 0
              ? "unconfirmed"
              : confirmations < REQUIRED_CONFIRMATIONS
                ? "confirming"
                : "processing",
        });
      }
    }

    // add server tracked deposits (4+ confirmations, not yet credited)
    for (const deposit of serverDeposits) {
      result.push({
        txid: deposit.txid,
        vout: deposit.vout,
        valueSats: deposit.valueSats,
        confirmations: deposit.confirmations,
        status: "processing",
      });
    }

    // by confirmations ascending
    result.sort((a, b) => a.confirmations - b.confirmations);

    return result;
  }, [tipHeightQuery.data, mempoolTxQuery.data, serverPendingQuery.data, depositAddress]);

  return {
    deposits,
    isLoading: mempoolTxQuery.isLoading || tipHeightQuery.isLoading,
    hasPending: deposits.length > 0,
  };
}
