"use client";

import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/react";

const PRICE_REFETCH_INTERVAL_1_MINUTE_MS = 60_000;

export interface PriceData {
  btc: number | null;
  updatedAtMs: number | null;
}

export function usePrices() {
  const trpc = useTRPC();

  return useQuery({
    ...trpc.market.getPrices.queryOptions(),
    staleTime: PRICE_REFETCH_INTERVAL_1_MINUTE_MS,
    refetchInterval: PRICE_REFETCH_INTERVAL_1_MINUTE_MS,
  });
}
