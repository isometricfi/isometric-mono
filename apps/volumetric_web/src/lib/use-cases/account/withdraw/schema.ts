import { z } from "zod";
import { walletProofInputSchema } from "../../_shared/wallet-proof";

export const inputSchema = walletProofInputSchema.extend({
  btcAddress: z.string().min(1),
  amount: z.string().regex(/^\d+$/, "Amount must be a numeric string"),
});

export type Input = z.infer<typeof inputSchema>;

export interface Output {
  blockIndex: bigint;
}
