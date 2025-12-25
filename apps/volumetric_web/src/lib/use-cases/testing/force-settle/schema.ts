import { z } from "zod";

export const inputSchema = z.object({
  optionId: z.string(),
});

export type Input = z.infer<typeof inputSchema>;

export interface Output {
  optionId: string;
  settlementPriceCents: string;
  payoutToBuyer: string;
  payoutToWriter: string;
}
