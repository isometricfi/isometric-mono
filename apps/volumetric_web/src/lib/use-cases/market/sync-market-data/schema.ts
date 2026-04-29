import { z } from "zod";

export const outputSchema = z.object({
  success: z.literal(true),
  currentPriceUpdated: z.boolean(),
  historyRefreshed: z.boolean(),
  historyPointsSaved: z.number(),
});

export type Output = z.infer<typeof outputSchema>;
