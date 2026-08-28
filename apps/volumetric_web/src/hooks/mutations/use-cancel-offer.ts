"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { DEMO_USER_SIGNATURE } from "@/lib/demo/demo-canister-browser";
import { getNiceErrorMessage } from "@/lib/error-message";
import { computeExpiresAtSeconds } from "@/lib/use-cases/_shared/wallet-proof";
import type { Output as CancelOfferOutput } from "@/lib/use-cases/options/cancel-offer/schema";
import { cancelOffer } from "@/lib/use-cases/options/cancel-offer/usecase";
import type { Output as PortfolioOutput } from "@/lib/use-cases/portfolio/get-portfolio/schema";
import { useBtcAddress } from "../queries/use-btc-address";

export type CancelOfferStep = "idle" | "signing" | "submitting" | "success" | "error";

export function useCancelOffer() {
  const address = useBtcAddress("payment");
  const queryClient = useQueryClient();

  const [step, setStep] = useState<CancelOfferStep>("idle");

  const mutation = useMutation({
    mutationFn: async (offerId: string): Promise<CancelOfferOutput> => {
      if (!address) {
        throw new Error("Demo account not ready");
      }

      let toastId: string | number;

      const cancelPromise = (async () => {
        setStep("submitting");
        toastId = toast.loading(`Deleting offer #${offerId}...`);

        const expiresAtSeconds = computeExpiresAtSeconds();

        const result = await cancelOffer({
          address,
          signature: DEMO_USER_SIGNATURE,
          expiresAtSeconds: expiresAtSeconds.toString(),
          offerId: offerId.toString(),
        });

        toast.success(`Offer #${offerId} deleted successfully`, { id: toastId });
        return result;
      })();

      cancelPromise.catch((err) => {
        toast.error(getNiceErrorMessage(err) ?? `Failed to cancel offer #${offerId}`, {
          id: toastId,
        });
      });

      return cancelPromise;
    },
    onSuccess: (_data, offerId) => {
      setStep("success");
      queryClient.setQueriesData<PortfolioOutput>({ queryKey: ["portfolio"] }, (prev) =>
        prev ? { ...prev, offers: prev.offers.filter((o) => o.id !== offerId.toString()) } : prev,
      );
      queryClient.invalidateQueries({ queryKey: ["portfolio"] });
      queryClient.invalidateQueries({ queryKey: ["options"] });
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
