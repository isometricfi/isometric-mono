"use client";

import { isBitcoinWallet } from "@dynamic-labs/bitcoin";
import { useDynamicContext } from "@dynamic-labs/sdk-react-core";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { unwrapResult } from "@volumetric/canister-types";
import { useState } from "react";
import { computeExpiresAtSeconds } from "@/lib/use-cases/_shared/wallet-proof";
import type { Output as WithdrawOutput } from "@/lib/use-cases/account/withdraw/schema";
import { trpcClient } from "@/trpc/react";
import { useBtcAddress } from "../queries/use-btc-address";
import { useCanister } from "../use-canister";

export type WithdrawStep = "idle" | "signing" | "submitting" | "success" | "error";

export interface WithdrawParams {
  amountSats: bigint;
}

export function useWithdraw() {
  const { primaryWallet } = useDynamicContext();
  const canister = useCanister();
  const address = useBtcAddress("payment");
  const queryClient = useQueryClient();

  const [step, setStep] = useState<WithdrawStep>("idle");

  const mutation = useMutation<WithdrawOutput, Error, WithdrawParams>({
    mutationFn: async ({ amountSats }: WithdrawParams): Promise<WithdrawOutput> => {
      if (!canister || !address) {
        throw new Error("Wallet not connected");
      }
      if (!primaryWallet || !isBitcoinWallet(primaryWallet)) {
        throw new Error("Bitcoin wallet not connected");
      }
      if (amountSats <= BigInt(0)) {
        throw new Error("Enter an amount");
      }

      setStep("signing");

      const expiresAtSeconds = computeExpiresAtSeconds();
      const message = unwrapResult(
        await canister.get_withdraw_message(address, amountSats, expiresAtSeconds),
      );
      const signature = await primaryWallet.signMessage(message, { addressType: "payment" });

      if (!signature) {
        throw new Error("Failed to sign message");
      }

      setStep("submitting");

      return trpcClient.account.withdraw.mutate({
        address,
        signature,
        expiresAtSeconds: expiresAtSeconds.toString(),
        amount: amountSats.toString(),
      });
    },
    onSuccess: () => {
      setStep("success");
      queryClient.invalidateQueries({ queryKey: [["account"]] });
    },
    onError: () => {
      setStep("error");
    },
  });

  const reset = () => {
    setStep("idle");
    mutation.reset();
  };

  return { ...mutation, step, reset };
}
