"use client";

import { useQuery } from "@tanstack/react-query";
import type { Output as GetPricesOutput } from "@/lib/use-cases/market/get-prices/schema";
import { useTRPC } from "@/trpc/react";

const PRICE_REFETCH_INTERVAL_30_SECONDS_MS = 30_000;

export type PriceData = GetPricesOutput;

export function usePrices() {
  const trpc = useTRPC();

  return useQuery({
    ...trpc.market.getPrices.queryOptions(),
    staleTime: PRICE_REFETCH_INTERVAL_30_SECONDS_MS,
    refetchInterval: PRICE_REFETCH_INTERVAL_30_SECONDS_MS,
  });
}
