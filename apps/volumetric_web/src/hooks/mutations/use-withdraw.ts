"use client";

import { isBitcoinWallet } from "@dynamic-labs/bitcoin";
import { useDynamicContext } from "@dynamic-labs/sdk-react-core";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Output as WithdrawOutput } from "@/lib/use-cases/account/withdraw/schema";
import { trpcClient } from "@/trpc/react";
import { useBtcAddress } from "../queries/use-btc-address";
import { useCanister } from "../use-canister";

export interface WithdrawParams {
  amountSats: bigint;
  btcAddress: string;
}

export function useWithdraw() {
  const { primaryWallet } = useDynamicContext();
  const canister = useCanister();
  const address = useBtcAddress("payment");
  const queryClient = useQueryClient();

  return useMutation<WithdrawOutput, Error, WithdrawParams>({
    mutationFn: async ({ amountSats, btcAddress }: WithdrawParams): Promise<WithdrawOutput> => {
      if (!canister || !address) {
        throw new Error("Wallet not connected");
      }
      if (!primaryWallet || !isBitcoinWallet(primaryWallet)) {
        throw new Error("Bitcoin wallet not connected");
      }
      if (!btcAddress) {
        throw new Error("Missing destination address");
      }
      if (amountSats <= BigInt(0)) {
        throw new Error("Enter an amount");
      }

      const message = await canister.get_withdraw_message(address, btcAddress, amountSats);
      const signature = await primaryWallet.signMessage(message, { addressType: "payment" });

      if (!signature) {
        throw new Error("Failed to sign message");
      }

      return trpcClient.account.withdraw.mutate({
        address,
        signature,
        btcAddress,
        amount: amountSats.toString(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [["account"]] });
    },
  });
}
