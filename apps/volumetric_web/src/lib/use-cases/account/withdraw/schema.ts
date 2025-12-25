import { z } from "zod";

export const inputSchema = z.object({
  address: z.string().min(1),
  signature: z.string().min(1),
  btcAddress: z.string().min(1),
  amount: z.string().regex(/^\d+$/, "Amount must be a numeric string"),
});

export type Input = z.infer<typeof inputSchema>;

export interface Output {
  blockIndex: bigint;
}
