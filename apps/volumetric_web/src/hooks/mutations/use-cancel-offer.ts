"use client";

import { isBitcoinWallet } from "@dynamic-labs/bitcoin";
import { useDynamicContext } from "@dynamic-labs/sdk-react-core";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { unwrapResult } from "@volumetric/canister-types";
import { useState } from "react";
import { toast } from "sonner";
import { computeExpiresAtSeconds } from "@/lib/use-cases/_shared/wallet-proof";
import type { Output as CancelOfferOutput } from "@/lib/use-cases/options/cancel-offer/schema";
import { trpcClient } from "@/trpc/react";
import { useBtcAddress } from "../queries/use-btc-address";
import { useCanister } from "../use-canister";

export type CancelOfferStep = "idle" | "signing" | "submitting" | "success" | "error";

export function useCancelOffer() {
  const { primaryWallet } = useDynamicContext();
  const canister = useCanister();
  const address = useBtcAddress("payment");
  const queryClient = useQueryClient();

  const [step, setStep] = useState<CancelOfferStep>("idle");

  const mutation = useMutation({
    mutationFn: async (offerId: string): Promise<CancelOfferOutput> => {
      if (!canister || !address) {
        throw new Error("Wallet not connected");
      }
      if (!primaryWallet || !isBitcoinWallet(primaryWallet)) {
        throw new Error("Bitcoin wallet not connected");
      }

      let toastId: string | number;

      const cancelPromise = (async () => {
        setStep("signing");
        toastId = toast.loading(`Approve deletion of offer #${offerId}`);

        const expiresAtSeconds = computeExpiresAtSeconds();
        const message = unwrapResult(
          await canister.get_cancel_offer_message(address, BigInt(offerId), expiresAtSeconds),
        );
        const signature = await primaryWallet.signMessage(message, { addressType: "payment" });

        if (!signature) {
          throw new Error("Failed to sign message");
        }

        setStep("submitting");
        toast.loading(`Deleting offer #${offerId}...`, { id: toastId });

        const result = await trpcClient.options.cancelOffer.mutate({
          address,
          signature,
          expiresAtSeconds: expiresAtSeconds.toString(),
          offerId: offerId.toString(),
        });

        toast.success(`Offer #${offerId} deleted successfully`, { id: toastId });
        return result;
      })();

      cancelPromise.catch((err) => {
        toast.error(err.message || `Failed to cancel offer #${offerId}`, { id: toastId });
      });

      return cancelPromise;
    },
    onSuccess: () => {
      setStep("success");
      queryClient.invalidateQueries({ queryKey: [["portfolio"]] });
      queryClient.invalidateQueries({ queryKey: [["options"]] });
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
