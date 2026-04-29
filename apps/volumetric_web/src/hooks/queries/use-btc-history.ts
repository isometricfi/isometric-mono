"use client";

import { useQuery } from "@tanstack/react-query";
import {
  DEFAULT_BTC_HISTORY_DAYS,
  MAX_BTC_HISTORY_DAYS,
  MIN_BTC_HISTORY_DAYS,
} from "@/lib/market/btc-history-limits";
import { useTRPC } from "@/trpc/react";

const BTC_HISTORY_REFETCH_INTERVAL_1_MINUTE_MS = 60_000;

export interface BTCHistoryPoint {
  timestamp: number;
  price: number;
  date: Date;
}

export function useBTCHistory(days = DEFAULT_BTC_HISTORY_DAYS) {
  const trpc = useTRPC();
  const historyDays = getBoundedHistoryDays(days);

  return useQuery({
    ...trpc.market.getBtcHistory.queryOptions({ days: historyDays }),
    staleTime: BTC_HISTORY_REFETCH_INTERVAL_1_MINUTE_MS,
    refetchInterval: BTC_HISTORY_REFETCH_INTERVAL_1_MINUTE_MS,
    select: (data): BTCHistoryPoint[] =>
      data.map((point) => ({
        ...point,
        date: new Date(point.timestamp),
      })),
  });
}

function getBoundedHistoryDays(days: number): number {
  return Math.min(MAX_BTC_HISTORY_DAYS, Math.max(MIN_BTC_HISTORY_DAYS, Math.ceil(days)));
}
