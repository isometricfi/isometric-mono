import { z } from "zod";

const acceptOfferItemSchema = z.object({
  offerId: z.string(),
  quantity: z.string(),
});

export const inputSchema = z.object({
  address: z.string().min(1),
  signature: z.string().min(1),
  items: z.array(acceptOfferItemSchema).min(1),
});

export type AcceptOfferItem = z.infer<typeof acceptOfferItemSchema>;
export type Input = z.infer<typeof inputSchema>;

export interface Output {
  fillGroupId: string;
  activeOptionIds: string[];
}
