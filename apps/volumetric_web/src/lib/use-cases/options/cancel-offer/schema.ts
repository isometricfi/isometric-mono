import { z } from "zod";
import { walletProofInputSchema } from "../../_shared/wallet-proof";

export const inputSchema = walletProofInputSchema.extend({
  offerId: z.string().regex(/^\d+$/),
});

export type Input = z.infer<typeof inputSchema>;

export interface Output {
  success: true;
}
