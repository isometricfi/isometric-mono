import { z } from "zod";

export const outputSchema = z.object({
  rowsProcessed: z.number(),
  blockIndexResolved: z.number(),
  txidResolved: z.number(),
  completed: z.number(),
  failed: z.number(),
  expired: z.number(),
});

export type Output = z.infer<typeof outputSchema>;
