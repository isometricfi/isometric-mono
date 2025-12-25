"use client";

import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/react";
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
  const trpc = useTRPC();
  return useQuery({
    ...trpc.config.getConfig.queryOptions(),
    staleTime: 300000,
  });
}
