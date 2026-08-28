"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { DEMO_USER_SIGNATURE } from "@/lib/demo/demo-canister-browser";
import { computeExpiresAtSeconds } from "@/lib/use-cases/_shared/wallet-proof";
import type { Output as UpdateUsernameOutput } from "@/lib/use-cases/account/update-username/schema";
import { updateUsername } from "@/lib/use-cases/account/update-username/usecase";
import { useBtcAddress } from "../queries/use-btc-address";

export interface UpdateUsernameParams {
  username: string;
}

export function useUpdateUsername() {
  const address = useBtcAddress("payment");
  const queryClient = useQueryClient();

  return useMutation<UpdateUsernameOutput, Error, UpdateUsernameParams>({
    mutationFn: async ({ username }: UpdateUsernameParams): Promise<UpdateUsernameOutput> => {
      const trimmed = username.trim();

      if (!address) {
        throw new Error("Demo account not ready");
      }
      if (!trimmed) {
        throw new Error("Enter a username");
      }

      const expiresAtSeconds = computeExpiresAtSeconds();

      return updateUsername({
        address,
        signature: DEMO_USER_SIGNATURE,
        expiresAtSeconds: expiresAtSeconds.toString(),
        username: trimmed,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["account"] });
    },
  });
}
