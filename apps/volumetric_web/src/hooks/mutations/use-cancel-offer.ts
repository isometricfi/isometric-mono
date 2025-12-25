"use client";

import { isBitcoinWallet } from "@dynamic-labs/bitcoin";
import { useDynamicContext } from "@dynamic-labs/sdk-react-core";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import type { CancelOfferResponse } from "@/app/api/options/cancel/types";
import { QueryKey } from "@/lib/query-keys";
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
    mutationFn: async (offerId: string): Promise<CancelOfferResponse> => {
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

        const message = await canister.get_cancel_offer_message(address, BigInt(offerId));
        const signature = await primaryWallet.signMessage(message, { addressType: "payment" });

        if (!signature) {
          throw new Error("Failed to sign message");
        }

        setStep("submitting");
        toast.loading(`Deleting offer #${offerId}...`, { id: toastId });

        const response = await fetch("/api/options/cancel", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            address,
            signature,
            offerId: offerId.toString(),
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error?.message || data.error || "Failed to cancel offer");
        }

        toast.success(`Offer #${offerId} deleted successfully`, { id: toastId });
        return data;
      })();

      cancelPromise.catch((err) => {
        toast.error(err.message || `Failed to cancel offer #${offerId}`, { id: toastId });
      });

      return cancelPromise;
    },
    onSuccess: () => {
      setStep("success");
      queryClient.invalidateQueries({ queryKey: [QueryKey.Portfolio] });
      queryClient.invalidateQueries({ queryKey: [QueryKey.Options] });
      queryClient.invalidateQueries({ queryKey: [QueryKey.AccountInfo] });
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
