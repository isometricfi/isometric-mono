import { z } from "zod";

export const inputSchema = z.object({
  address: z.string().min(1),
});

export type Input = z.infer<typeof inputSchema>;

export interface ProfileData {
  address: string;
  username: string | null;
  principal: string;
  inviteCode: string | null;
}

export interface BalanceData {
  total: bigint;
  available: bigint;
  locked: bigint;
}

export interface RewardsData {
  points: bigint;
  referrals: bigint;
}

export interface Output {
  profile: ProfileData | null;
  balance: BalanceData | null;
  rewards: RewardsData;
}
