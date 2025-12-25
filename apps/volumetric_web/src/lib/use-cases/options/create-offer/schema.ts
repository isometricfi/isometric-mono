import { z } from "zod";

export const inputSchema = z.object({
  address: z.string().min(1),
  signature: z.string().min(1),
  quantity: z.string(),
  strikeBasisPoints: z.number(),
  premiumBasisPoints: z.number(),
  offerValidUntil: z.string(),
  optionDurationSeconds: z.string(),
});

export type Input = z.infer<typeof inputSchema>;

export interface Output {
  offerId: string;
}
