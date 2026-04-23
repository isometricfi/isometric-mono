import type { WalletProof } from "@volumetric/canister-types";
import { z } from "zod";

const SIGNING_WINDOW_SECONDS = 300;

export const walletProofInputSchema = z.object({
  address: z.string().min(1),
  signature: z.string().min(1),
  expiresAtSeconds: z.string().regex(/^\d+$/, "expiresAtSeconds must be a numeric string"),
});

export type WalletProofInput = z.infer<typeof walletProofInputSchema>;

export function toCanisterWalletProof(input: WalletProofInput): WalletProof {
  return {
    address: input.address,
    signature: input.signature,
  };
}

export function computeExpiresAtSeconds(): bigint {
  return BigInt(Math.floor(Date.now() / 1000) + SIGNING_WINDOW_SECONDS);
}
