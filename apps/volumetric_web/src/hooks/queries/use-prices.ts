"use client";

import { useQuery } from "@tanstack/react-query";

interface PriceData {
  btc: number;
}

async function fetchPrices(): Promise<PriceData> {
  const response = await fetch(
    "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd",
  );

  if (!response.ok) {
    throw new Error("Failed to fetch prices");
  }

  const data = await response.json();

  return {
    btc: data.bitcoin.usd,
  };
}

export function usePrices() {
  return useQuery({
    queryKey: ["prices"],
    queryFn: fetchPrices,
    staleTime: 60000,
    refetchInterval: 60000,
  });
}
