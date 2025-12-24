"use client";

import { isBitcoinWallet } from "@dynamic-labs/bitcoin";
import { useDynamicContext } from "@dynamic-labs/sdk-react-core";
import { trpc } from "@/lib/trpc";
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
  const utils = trpc.useUtils();

  const mutation = trpc.account.withdraw.useMutation({
    onSuccess: () => {
      utils.account.get.invalidate();
    },
  });

  const mutateAsync = async ({ amountSats, btcAddress }: WithdrawParams) => {
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

    return mutation.mutateAsync({
      address,
      signature,
      btcAddress,
      amount: amountSats,
    });
  };

  return {
    ...mutation,
    mutateAsync,
  };
}
