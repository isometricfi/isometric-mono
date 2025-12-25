import { z } from "zod";

// Request
export const SettleOptionRequestSchema = z.object({
  optionId: z.string(),
});

export type SettleOptionRequest = z.infer<typeof SettleOptionRequestSchema>;

// Response
export const SettleOptionResponseSchema = z.object({
  optionId: z.string(),
  settlementPriceCents: z.bigint(),
  payoutToBuyer: z.bigint(),
  payoutToWriter: z.bigint(),
});

export type SettleOptionResponse = z.infer<typeof SettleOptionResponseSchema>;
