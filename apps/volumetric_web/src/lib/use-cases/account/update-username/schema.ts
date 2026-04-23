import { z } from "zod";
import { walletProofInputSchema } from "../../_shared/wallet-proof";

export const inputSchema = walletProofInputSchema.extend({
  username: z.string().min(1),
});

export type Input = z.infer<typeof inputSchema>;

export interface Output {
  principal: string;
  subaccount: number[];
  address: string;
  username: string | null;
}
