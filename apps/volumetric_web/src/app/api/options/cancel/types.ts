import { z } from "zod";

// Request
export const CancelOfferRequestSchema = z.object({
  address: z.string().min(1),
  signature: z.string().min(1),
  offerId: z.string(),
});

export type CancelOfferRequest = z.infer<typeof CancelOfferRequestSchema>;

// Response
export const CancelOfferResponseSchema = z.object({
  success: z.boolean(),
});

export type CancelOfferResponse = z.infer<typeof CancelOfferResponseSchema>;
