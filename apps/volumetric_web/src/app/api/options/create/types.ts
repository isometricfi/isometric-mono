import { z } from "zod";

// Request
export const CreateOfferRequestSchema = z.object({
  address: z.string().min(1),
  signature: z.string().min(1),
  quantity: z.string(),
  strikeBasisPoints: z.number(),
  premiumBasisPoints: z.number(),
  offerValidUntil: z.string(),
  optionDurationSeconds: z.string(),
});

export type CreateOfferRequest = z.infer<typeof CreateOfferRequestSchema>;

// Response
export const CreateOfferResponseSchema = z.object({
  offerId: z.string(),
});

export type CreateOfferResponse = z.infer<typeof CreateOfferResponseSchema>;
