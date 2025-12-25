import { z } from "zod";

// Request
export const AcceptOfferItemSchema = z.object({
  offerId: z.string(),
  quantity: z.string(),
});

export const AcceptOffersRequestSchema = z.object({
  address: z.string().min(1),
  signature: z.string().min(1),
  items: z.array(AcceptOfferItemSchema).min(1),
});

export type AcceptOfferItem = z.infer<typeof AcceptOfferItemSchema>;
export type AcceptOffersRequest = z.infer<typeof AcceptOffersRequestSchema>;

// Response
export const AcceptOffersResponseSchema = z.object({
  fillGroupId: z.string(),
  activeOptionIds: z.array(z.string()),
});

export type AcceptOffersResponse = z.infer<typeof AcceptOffersResponseSchema>;
