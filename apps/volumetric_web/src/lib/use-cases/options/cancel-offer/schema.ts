import { z } from "zod";

export const inputSchema = z.object({
  address: z.string().min(1),
  signature: z.string().min(1),
  offerId: z.string(),
});

export type Input = z.infer<typeof inputSchema>;

export interface Output {
  success: true;
}
