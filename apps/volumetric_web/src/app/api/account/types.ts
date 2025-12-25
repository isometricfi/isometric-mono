import { z } from "zod";

// Request
export const AccountRequestSchema = z.object({
  address: z.string().min(1),
});

export type AccountRequest = z.infer<typeof AccountRequestSchema>;

// Response
export const ProfileDataSchema = z.object({
  address: z.string(),
  username: z.string().nullable(),
  principal: z.string(),
});

export const BalanceDataSchema = z.object({
  total: z.bigint(),
  available: z.bigint(),
  locked: z.bigint(),
});

export const AccountResponseSchema = z.object({
  profile: ProfileDataSchema.nullable(),
  balance: BalanceDataSchema.nullable(),
});

export type ProfileData = z.infer<typeof ProfileDataSchema>;
export type BalanceData = z.infer<typeof BalanceDataSchema>;
export type AccountResponse = z.infer<typeof AccountResponseSchema>;
