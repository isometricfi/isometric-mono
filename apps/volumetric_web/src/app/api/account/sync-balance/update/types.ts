import { z } from "zod";

// Request
export const SyncBalanceRequestSchema = z.object({
  address: z.string().min(1),
});

export type SyncBalanceRequest = z.infer<typeof SyncBalanceRequestSchema>;

// Response
export const SyncBalanceResponseSchema = z.object({
  success: z.literal(true),
});

export type SyncBalanceResponse = z.infer<typeof SyncBalanceResponseSchema>;
