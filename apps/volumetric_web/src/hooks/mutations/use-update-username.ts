"use client";

import { isBitcoinWallet } from "@dynamic-labs/bitcoin";
import { useDynamicContext } from "@dynamic-labs/sdk-react-core";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { unwrapResult } from "@volumetric/canister-types";
import type { Output as UpdateUsernameOutput } from "@/lib/use-cases/account/update-username/schema";
import { trpcClient } from "@/trpc/react";
import { useBtcAddress } from "../queries/use-btc-address";
import { useCanister } from "../use-canister";

export interface UpdateUsernameParams {
  username: string;
}

export function useUpdateUsername() {
  const { primaryWallet } = useDynamicContext();
  const canister = useCanister();
  const address = useBtcAddress("payment");
  const queryClient = useQueryClient();

  return useMutation<UpdateUsernameOutput, Error, UpdateUsernameParams>({
    mutationFn: async ({ username }: UpdateUsernameParams): Promise<UpdateUsernameOutput> => {
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

      const message = unwrapResult(await canister.get_username_update_message(address, trimmed));
      const signature = await primaryWallet.signMessage(message, { addressType: "payment" });

      if (!signature) {
        throw new Error("Failed to sign message");
      }

      return trpcClient.account.updateUsername.mutate({
        address,
        signature,
        username: trimmed,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [["account"]] });
    },
  });
}
