"use client";

import { useQuery } from "@tanstack/react-query";
import type { FeatureKey } from "@/lib/use-cases/feature-interests/feature-keys";
import { useTRPC } from "@/trpc/react";
import { useBtcAddress } from "./use-btc-address";

export type FeatureInterestKey = FeatureKey;

export function useFeatureInterestStatus(featureKey: FeatureInterestKey) {
  const trpc = useTRPC();
  const address = useBtcAddress("payment");

  return useQuery(
    trpc.featureInterests.getStatus.queryOptions(
      {
        featureKey,
        address: address ?? undefined,
      },
      {
        staleTime: 24 * 60 * 60 * 1000,
        gcTime: 24 * 60 * 60 * 1000,
      },
    ),
  );
}
