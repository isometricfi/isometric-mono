import { z } from "zod";

// Request
export const TestingForceSettleRequestSchema = z.object({
  optionId: z.string(),
});

export type TestingForceSettleRequest = z.infer<typeof TestingForceSettleRequestSchema>;

// Response
export const TestingForceSettleResponseSchema = z.object({
  optionId: z.string(),
  settlementPriceCents: z.string(),
  payoutToBuyer: z.string(),
  payoutToWriter: z.string(),
});

export type TestingForceSettleResponse = z.infer<typeof TestingForceSettleResponseSchema>;
