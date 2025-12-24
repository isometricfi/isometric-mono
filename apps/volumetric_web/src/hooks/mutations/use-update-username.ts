"use client";

import { isBitcoinWallet } from "@dynamic-labs/bitcoin";
import { useDynamicContext } from "@dynamic-labs/sdk-react-core";
import { trpc } from "@/lib/trpc";
import { useBtcAddress } from "../queries/use-btc-address";
import { useCanister } from "../use-canister";

export interface UpdateUsernameParams {
  username: string;
}

export function useUpdateUsername() {
  const { primaryWallet } = useDynamicContext();
  const canister = useCanister();
  const address = useBtcAddress("payment");
  const utils = trpc.useUtils();

  const mutation = trpc.account.updateUsername.useMutation({
    onSuccess: () => {
      utils.account.get.invalidate();
    },
  });

  const mutateAsync = async ({ username }: UpdateUsernameParams) => {
    const trimmed = username.trim();

    if (!canister || !address) {
      throw new Error("Wallet not connected");
    }
    if (!primaryWallet || !isBitcoinWallet(primaryWallet)) {
      throw new Error("Bitcoin wallet not connected");
    }
    if (!trimmed) {
      throw new Error("Enter a username");
    }

    const message = await canister.get_username_update_message(address, trimmed);
    const signature = await primaryWallet.signMessage(message, { addressType: "payment" });

    if (!signature) {
      throw new Error("Failed to sign message");
    }

    return mutation.mutateAsync({
      address,
      signature,
      username: trimmed,
    });
  };

  return {
    ...mutation,
    mutateAsync,
  };
}
