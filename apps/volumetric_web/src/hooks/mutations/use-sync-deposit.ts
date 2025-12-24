"use client";

import { trpc } from "@/lib/trpc";
import { useBtcAddress } from "../queries/use-btc-address";

export function useSyncDeposit() {
  const address = useBtcAddress("payment");
  const utils = trpc.useUtils();

  const mutation = trpc.account.syncBalance.useMutation({
    onSuccess: () => {
      utils.account.get.invalidate();
    },
  });

  const mutate = () => {
    if (!address) {
      throw new Error("Wallet not connected");
    }
    mutation.mutate({ address });
  };

  const mutateAsync = async () => {
    if (!address) {
      throw new Error("Wallet not connected");
    }
    return mutation.mutateAsync({ address });
  };

  return {
    ...mutation,
    mutate,
    mutateAsync,
  };
}
