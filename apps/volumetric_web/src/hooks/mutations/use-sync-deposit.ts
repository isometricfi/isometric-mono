"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { trpcClient } from "@/trpc/react";
import { useBtcAddress } from "../queries/use-btc-address";

export function useSyncDeposit() {
  const address = useBtcAddress("payment");
  const queryClient = useQueryClient();

  return useMutation<void, Error, void>({
    mutationFn: async (): Promise<void> => {
      if (!address) {
        throw new Error("Wallet not connected");
      }

      await trpcClient.account.syncBalance.mutate({ address });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [["account"]] });
    },
  });
}
