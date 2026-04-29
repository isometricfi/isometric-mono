"use client";

import { useQuery } from "@tanstack/react-query";
import {
  DEFAULT_BTC_HISTORY_DAYS,
  MAX_BTC_HISTORY_DAYS,
  MIN_BTC_HISTORY_DAYS,
} from "@/lib/market/btc-history-limits";
import { fetchBtcHistory } from "@/lib/market/coinbase-public-client";

const BTC_HISTORY_STALE_TIME_5_MINUTES_MS = 5 * 60_000;
const BTC_HISTORY_REFETCH_INTERVAL_5_MINUTES_1_SECOND_MS = 5 * 60_000 + 1_000;

export interface BTCHistoryPoint {
  timestamp: number;
  price: number;
  date: Date;
}

async function fetchBtcHistoryPoints(days: number): Promise<BTCHistoryPoint[]> {
  const points = await fetchBtcHistory(days);
  return points.map((point) => ({
    timestamp: point.timestampMs,
    price: point.priceUsd,
    date: new Date(point.timestampMs),
  }));
}

export function useBTCHistory(days = DEFAULT_BTC_HISTORY_DAYS) {
  const historyDays = getBoundedHistoryDays(days);

  return useQuery({
    queryKey: ["btc-history", historyDays],
    queryFn: () => fetchBtcHistoryPoints(historyDays),
    staleTime: BTC_HISTORY_STALE_TIME_5_MINUTES_MS,
    refetchInterval: BTC_HISTORY_REFETCH_INTERVAL_5_MINUTES_1_SECOND_MS,
  });
}

function getBoundedHistoryDays(days: number): number {
  return Math.min(MAX_BTC_HISTORY_DAYS, Math.max(MIN_BTC_HISTORY_DAYS, Math.ceil(days)));
}
