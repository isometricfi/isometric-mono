"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchConfig } from "@/lib/fetchers";
import { QueryKey } from "@/lib/query-keys";
import type { ConfigData } from "@/types/config";

export function generatePremiumValues(config: ConfigData | undefined): number[] {
  if (!config) return [];

  const values: number[] = [];
  for (let v = config.premium.min; v <= config.premium.max; v += config.premium.step) {
    values.push(Number(v.toFixed(2)));
  }
  return values;
}

export function useConfig() {
  return useQuery({
    queryKey: [QueryKey.Config],
    queryFn: fetchConfig,
    staleTime: 300000, // 5 min
  });
}
