import { z } from "zod";

export const inputSchema = z.object({
  address: z.string().min(1),
});

export const pendingDepositStatusSchema = z.enum(["matured", "syncing"]);

export const outputSchema = z.object({
  requiredConfirmations: z.number(),
  pendingDeposits: z.array(
    z.object({
      key: z.string(),
      txid: z.string(),
      vout: z.number(),
      valueSats: z.number(),
      confirmations: z.number(),
      firstSeenAtMs: z.number(),
      nextSyncAtMs: z.number(),
      lastSyncAtMs: z.number().nullable(),
      status: pendingDepositStatusSchema,
    }),
  ),
});

export type Input = z.infer<typeof inputSchema>;
export type Output = z.infer<typeof outputSchema>;
