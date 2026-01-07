"use client";

import { useQuery } from "@tanstack/react-query";

export interface BTCHistoryPoint {
  timestamp: number;
  price: number;
  date: Date;
}

interface CoinGeckoMarketChartResponse {
  prices: [number, number][];
}

async function fetchBTCHistory(days: number): Promise<BTCHistoryPoint[]> {
  const response = await fetch(
    `https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=usd&days=${days}&interval=daily`,
  );

  if (!response.ok) {
    throw new Error("Failed to fetch BTC history");
  }

  const data: CoinGeckoMarketChartResponse = await response.json();

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
    staleTime: 60000,
    refetchInterval: 60000,
  });
}
