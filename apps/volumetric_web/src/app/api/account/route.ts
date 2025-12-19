import { z } from "zod";
import { createApiHandler } from "@/lib/api-handler";
import { getCanisterActor } from "@/lib/canister-server";

const RequestSchema = z.object({
  address: z.string().min(1),
});

export type AccountRequest = z.infer<typeof RequestSchema>;

export type AccountResponse = {
  profile: {
    address: string;
    username: string | null;
    principal: string;
  } | null;
  balance: {
    total: string;
    available: string;
    locked: string;
  } | null;
};

export const POST = createApiHandler(RequestSchema, async ({ address }) => {
  const actor = await getCanisterActor();

  const [profileResult, balanceResult] = await Promise.all([
    actor.get_account_info(address),
    actor.get_user_balance(address),
  ]);

  const profile = profileResult.length > 0 ? profileResult[0] : null;
  const balanceData = "Ok" in balanceResult ? balanceResult.Ok : null;

  return {
    profile: profile
      ? {
          address: profile.address,
          username: profile.username.length > 0 ? (profile.username[0] ?? null) : null,
          principal: profile.principal.toString(),
        }
      : null,
    balance: balanceData
      ? {
          total: balanceData.total.toString(),
          available: balanceData.available.toString(),
          locked: balanceData.locked.toString(),
        }
      : null,
  } satisfies AccountResponse;
});
