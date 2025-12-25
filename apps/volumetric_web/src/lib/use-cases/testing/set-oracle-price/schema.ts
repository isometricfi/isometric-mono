import { z } from "zod";

export const inputSchema = z.object({
  priceCents: z.string(),
});

export type Input = z.infer<typeof inputSchema>;

export interface Output {
  success: true;
}
