import { z } from "zod";

// Request
export const WithdrawRequestSchema = z.object({
  address: z.string().min(1),
  signature: z.string().min(1),
  btcAddress: z.string().min(1),
  amount: z.string().regex(/^\d+$/, "Amount must be a numeric string"),
});

export type WithdrawRequest = z.infer<typeof WithdrawRequestSchema>;

// Response
export const WithdrawResponseSchema = z.object({
  blockIndex: z.bigint(),
});

export type WithdrawResponse = z.infer<typeof WithdrawResponseSchema>;
