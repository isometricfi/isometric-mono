import { z } from "zod";

export const inputSchema = z.object({
  address: z.string().min(1),
});

export const pendingWithdrawalStatusSchema = z.enum(["broadcasting", "pending"]);

export const outputSchema = z.object({
  requiredConfirmations: z.number(),
  pendingWithdrawals: z.array(
    z.object({
      operationId: z.string(),
      destinationAddress: z.string(),
      amountSats: z.number(),
      bitcoinTxid: z.string().nullable(),
      confirmations: z.number(),
      status: pendingWithdrawalStatusSchema,
      createdAtMs: z.number(),
    }),
  ),
});

export type Input = z.infer<typeof inputSchema>;
export type Output = z.infer<typeof outputSchema>;
