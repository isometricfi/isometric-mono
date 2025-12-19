"use client";

import { isBitcoinWallet } from "@dynamic-labs/bitcoin";
import { useDynamicContext } from "@dynamic-labs/sdk-react-core";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { UpdateUsernameResponse } from "@/app/api/account/username/route";
import { QueryKey } from "@/lib/query-keys";
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

  return useMutation<UpdateUsernameResponse, Error, UpdateUsernameParams>({
    mutationFn: async ({ username }: UpdateUsernameParams): Promise<UpdateUsernameResponse> => {
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

      const response = await fetch("/api/account/username", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address, signature, username: trimmed }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || data.error || "Failed to update username");
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QueryKey.AccountInfo] });
    },
  });
}
