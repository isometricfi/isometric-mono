import { z } from "zod";
import { walletProofInputSchema } from "../../_shared/wallet-proof";

export const inputSchema = walletProofInputSchema.extend({
  amount: z.string().regex(/^\d+$/, "Amount must be a numeric string"),
});

export type Input = z.infer<typeof inputSchema>;

export interface Output {
  blockIndex: bigint;
}
