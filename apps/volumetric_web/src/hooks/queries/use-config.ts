"use client";

import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/react";
import type { ConfigData } from "@/types/config";

export function generatePremiumValues(config: ConfigData | undefined): number[] {
  if (!config) return [];

  const { min, max, step } = config.premium;
  const stepCount = Math.round((max - min) / step);
  const values: number[] = [];
  for (let i = 0; i <= stepCount; i++) {
    values.push(Number((min + i * step).toFixed(2)));
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
