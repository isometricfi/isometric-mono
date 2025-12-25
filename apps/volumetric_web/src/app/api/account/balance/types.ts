import { z } from "zod";

// Request
export const BalanceRequestSchema = z.object({
  address: z.string().min(1),
});

export type BalanceRequest = z.infer<typeof BalanceRequestSchema>;

// Response
export const BalanceResponseSchema = z.object({
  balance: z.bigint(),
});

export type BalanceResponse = z.infer<typeof BalanceResponseSchema>;
