import { z } from "zod";

export const outputSchema = z.object({
  success: z.literal(true),
  id: z.number().int().positive(),
  fetchedAtMs: z.number().int().positive(),
});

export type Output = z.infer<typeof outputSchema>;
