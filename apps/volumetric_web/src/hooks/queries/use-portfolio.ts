"use client";

import { useQuery } from "@tanstack/react-query";
import superjson from "superjson";
import type { PortfolioResponse } from "@/app/api/portfolio/types";
import { QueryKey } from "@/lib/query-keys";
import { useBtcAddress } from "./use-btc-address";

export function usePortfolio() {
  const address = useBtcAddress("payment");

  return useQuery({
    queryKey: [QueryKey.Portfolio, address],
    queryFn: async (): Promise<PortfolioResponse | null> => {
      if (!address) return null;

      const response = await fetch("/api/portfolio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address }),
      });

      if (!response.ok) {
        throw new Error("Failed to fetch portfolio data");
      }

      const text = await response.text();
      return superjson.parse<PortfolioResponse>(text);
    },
    enabled: !!address,
    refetchInterval: 30000,
  });
}
