import { z } from "zod";

export const outputSchema = z.object({
  usersScanned: z.number(),
  maturedDetected: z.number(),
  syncCalls: z.number(),
  creditedDeposits: z.number(),
  snapshotsSaved: z.number(),
});

export type Output = z.infer<typeof outputSchema>;
