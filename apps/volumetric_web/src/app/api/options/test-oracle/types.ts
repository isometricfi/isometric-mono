import { z } from "zod";

// Request
export const SetOraclePriceRequestSchema = z.object({
  priceCents: z.string(),
});

export type SetOraclePriceRequest = z.infer<typeof SetOraclePriceRequestSchema>;

// Response
export const SetOraclePriceResponseSchema = z.object({
  success: z.boolean(),
});

export type SetOraclePriceResponse = z.infer<typeof SetOraclePriceResponseSchema>;
