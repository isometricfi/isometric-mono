"use client";

import { useQuery } from "@tanstack/react-query";

export interface ConfigData {
  termOptions: number[];
  strikePercentOptions: number[];

  premium: {
    min: number;
    max: number;
    step: number;
  };

  minOfferAmountSats: number;
  maxOfferAmountSats: number;
  minDepositAmountSats: number;
  minWithdrawAmountSats: number;
}

async function fetchConfig(): Promise<ConfigData> {
  await new Promise((resolve) => setTimeout(resolve, 50));

  return {
    termOptions: [7, 14],
    strikePercentOptions: [5, 10, 15],
    premium: {
      min: 0.5,
      max: 5,
      step: 0.25,
    },
    minOfferAmountSats: 100_000,
    maxOfferAmountSats: 100_000_000, // 1 BTC
    minDepositAmountSats: 50_000,
    minWithdrawAmountSats: 50_000,
  };
}

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
    queryKey: ["config"],
    queryFn: fetchConfig,
    staleTime: 300000, // 5 min
  });
}
