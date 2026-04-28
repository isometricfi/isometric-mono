"use client";

import { useQuery } from "@tanstack/react-query";

export interface BTCHistoryPoint {
  timestamp: number;
  price: number;
  date: Date;
}

interface BTCHistoryResponse {
  prices: [number, number][];
}

async function fetchBTCHistory(days: number): Promise<BTCHistoryPoint[]> {
  const response = await fetch(`/api/btc/history?days=${days}`);

  if (!response.ok) {
    throw new Error("Failed to fetch BTC history");
  }

  const data = (await response.json()) as BTCHistoryResponse;

  return data.prices.map(([timestamp, price]) => ({
    timestamp,
    price,
    date: new Date(timestamp),
  }));
}

export function useBTCHistory(days = 30) {
  return useQuery({
    queryKey: ["btc-history", days],
    queryFn: () => fetchBTCHistory(days),
    staleTime: 5 * 60_000,
    refetchInterval: 5 * 60_000,
  });
}
