import { z } from "zod";
import { walletProofInputSchema } from "../../_shared/wallet-proof";

const NUMERIC_STRING = /^\d+$/;
const MIN_ACCEPT_QUANTITY_SATS = 40_000n;
const MAX_ACCEPT_QUANTITY_SATS = 100_000_000n;

const acceptOfferItemSchema = z.object({
  offerId: z.string().regex(NUMERIC_STRING),
  quantity: z
    .string()
    .regex(NUMERIC_STRING)
    .refine((value) => {
      const quantitySats = BigInt(value);
      return quantitySats >= MIN_ACCEPT_QUANTITY_SATS && quantitySats <= MAX_ACCEPT_QUANTITY_SATS;
    }, "quantity is outside the demo trading limits"),
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
