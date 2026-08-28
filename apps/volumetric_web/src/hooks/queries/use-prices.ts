"use client";

import { useQuery } from "@tanstack/react-query";
import type { Output as GetPricesOutput } from "@/lib/use-cases/market/get-prices/schema";
import { getMarketPrices } from "@/lib/use-cases/market/get-prices/usecase";

const PRICE_REFETCH_INTERVAL_30_SECONDS_MS = 30_000;

export type PriceData = GetPricesOutput;

export function usePrices() {
  return useQuery({
    queryKey: ["prices"],
    queryFn: () => getMarketPrices(),
    staleTime: PRICE_REFETCH_INTERVAL_30_SECONDS_MS,
    refetchInterval: PRICE_REFETCH_INTERVAL_30_SECONDS_MS,
  });
}
