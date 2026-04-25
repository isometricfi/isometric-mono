import { z } from "zod";
import { walletProofInputSchema } from "../../_shared/wallet-proof";

export const inputSchema = walletProofInputSchema.extend({
  quantity: z.string(),
  strikeBasisPoints: z.number(),
  premiumBasisPoints: z.number(),
  offerValidUntilSeconds: z.string(),
  optionDurationSeconds: z.string(),
});

export type Input = z.infer<typeof inputSchema>;

export interface Output {
  offerId: string;
}
