"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { FeatureKey } from "@/lib/use-cases/feature-interests/feature-keys";
import type { Output as VoteFeatureInterestOutput } from "@/lib/use-cases/feature-interests/vote-feature-interest/schema";
import { trpcClient } from "@/trpc/react";
import { useBtcAddress } from "../queries/use-btc-address";

export function useVoteFeatureInterest(featureKey: FeatureKey) {
  const queryClient = useQueryClient();
  const address = useBtcAddress("payment");

  return useMutation<VoteFeatureInterestOutput, Error, void>({
    mutationFn: async (): Promise<VoteFeatureInterestOutput> => {
      if (!address) {
        throw new Error("Wallet not connected");
      }

      return trpcClient.featureInterests.vote.mutate({
        featureKey,
        address,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [["featureInterests"]] });
    },
  });
}
