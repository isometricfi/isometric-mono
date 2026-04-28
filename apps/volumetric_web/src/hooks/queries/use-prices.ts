"use client";

import { useQuery } from "@tanstack/react-query";

interface PriceData {
  btc: number;
}

async function fetchPrices(): Promise<PriceData> {
  const response = await fetch("/api/btc/price");

  if (!response.ok) {
    throw new Error("Failed to fetch prices");
  }

  return (await response.json()) as PriceData;
}

export function usePrices() {
  return useQuery({
    queryKey: ["prices"],
    queryFn: fetchPrices,
    staleTime: 60_000,
    refetchInterval: 60_000,
  });
}
