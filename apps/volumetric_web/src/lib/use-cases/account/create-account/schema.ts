import { z } from "zod";
import { INVITE_CODE_PATTERN } from "@/lib/referrals/invite-code";
import { walletProofInputSchema } from "../../_shared/wallet-proof";

export const inputSchema = walletProofInputSchema.extend({
  inviteCode: z.string().trim().toUpperCase().regex(INVITE_CODE_PATTERN).optional(),
});

export type Input = z.infer<typeof inputSchema>;

export interface Output {
  principal: string;
  subaccount: number[];
  address: string;
  username: string | null;
}
