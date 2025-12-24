"use client";

import { trpc } from "@/lib/trpc";

interface ConfigData {
  termOptions: number[];
  strikePercentOptions: number[];
  premium: {
    min: number;
    max: number;
    step: number;
  };
  minOfferAmountSats: bigint;
  maxOfferAmountSats: bigint;
  minDepositAmountSats: bigint;
  minWithdrawAmountSats: bigint;
  minTermDays: number;
  maxTermDays: number;
  minOptionDurationSeconds: bigint;
  maxOptionDurationSeconds: bigint;
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
  return trpc.config.get.useQuery(undefined, {
    staleTime: 300000,
  });
}
