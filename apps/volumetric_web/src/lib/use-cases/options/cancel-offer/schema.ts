import { z } from "zod";
import { walletProofInputSchema } from "../../_shared/wallet-proof";

export const inputSchema = walletProofInputSchema.extend({
  offerId: z.string(),
});

export type Input = z.infer<typeof inputSchema>;

export interface Output {
  success: true;
}
