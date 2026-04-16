import { z } from "zod";
import { INVITE_CODE_PATTERN } from "@/lib/referrals/invite-code";

export const inputSchema = z.object({
  address: z.string().min(1),
  signature: z.string().min(1),
  inviteCode: z.string().trim().toUpperCase().regex(INVITE_CODE_PATTERN).optional(),
});

export type Input = z.infer<typeof inputSchema>;

export interface Output {
  principal: string;
  subaccount: number[];
  address: string;
  username: string | null;
}
