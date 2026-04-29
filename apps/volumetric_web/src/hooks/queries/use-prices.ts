"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchCurrentBtcPrice } from "@/lib/market/coinbase-public-client";

const PRICE_REFETCH_INTERVAL_30_SECONDS_MS = 30_000;

export interface PriceData {
  btc: number;
}

async function fetchPrices(): Promise<PriceData> {
  const { priceUsd } = await fetchCurrentBtcPrice();
  return { btc: priceUsd };
}

export function usePrices() {
  return useQuery({
    queryKey: ["prices"],
    queryFn: fetchPrices,
    staleTime: PRICE_REFETCH_INTERVAL_30_SECONDS_MS,
    refetchInterval: PRICE_REFETCH_INTERVAL_30_SECONDS_MS,
  });
}
