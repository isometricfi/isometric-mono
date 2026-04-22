import { z } from "zod";
import { walletProofInputSchema } from "../../_shared/wallet-proof";

const acceptOfferItemSchema = z.object({
  offerId: z.string(),
  quantity: z.string(),
});

export const inputSchema = walletProofInputSchema.extend({
  items: z.array(acceptOfferItemSchema).min(1),
});

export type AcceptOfferItem = z.infer<typeof acceptOfferItemSchema>;
export type Input = z.infer<typeof inputSchema>;

export interface Output {
  fillGroupId: string;
  activeOptionIds: string[];
}
