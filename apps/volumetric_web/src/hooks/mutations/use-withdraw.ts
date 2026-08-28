"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { DEMO_USER_SIGNATURE } from "@/lib/demo/demo-canister-browser";
import { computeExpiresAtSeconds } from "@/lib/use-cases/_shared/wallet-proof";
import type { Output as WithdrawOutput } from "@/lib/use-cases/account/withdraw/schema";
import { withdraw } from "@/lib/use-cases/account/withdraw/usecase";
import { useBtcAddress } from "../queries/use-btc-address";

export type WithdrawStep = "idle" | "signing" | "submitting" | "success" | "error";

export interface WithdrawParams {
  amountSats: bigint;
}

export function useWithdraw() {
  const address = useBtcAddress("payment");
  const queryClient = useQueryClient();

  const [step, setStep] = useState<WithdrawStep>("idle");

  const mutation = useMutation<WithdrawOutput, Error, WithdrawParams>({
    mutationFn: async ({ amountSats }: WithdrawParams): Promise<WithdrawOutput> => {
      if (!address) {
        throw new Error("Demo account not ready");
      }
      if (amountSats <= BigInt(0)) {
        throw new Error("Enter an amount");
      }

      const expiresAtSeconds = computeExpiresAtSeconds();
      setStep("submitting");

      return withdraw({
        address,
        signature: DEMO_USER_SIGNATURE,
        expiresAtSeconds: expiresAtSeconds.toString(),
        amount: amountSats.toString(),
      });
    },
    onSuccess: () => {
      setStep("success");
      queryClient.invalidateQueries({ queryKey: ["account"] });
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
