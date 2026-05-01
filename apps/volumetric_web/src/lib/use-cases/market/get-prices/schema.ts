import { z } from "zod";

export const outputSchema = z.object({
  btc: z.number().nullable(),
  updatedAtMs: z.number().nullable(),
});

export type Output = z.infer<typeof outputSchema>;
