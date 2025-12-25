import { createApiHandler } from "@/lib/api-handler";
import { getCanisterActor } from "@/lib/canister-server";
import { mapBalance, mapProfile } from "./mapper";
import { AccountRequestSchema, type AccountResponse } from "./types";

export const POST = createApiHandler(
  AccountRequestSchema,
  async ({ address }): Promise<AccountResponse> => {
    const actor = await getCanisterActor();

    const [profileResult, balanceResult] = await Promise.all([
      actor.get_account_info(address),
      actor.get_user_balance(address),
    ]);

    const profile = profileResult.length > 0 ? profileResult[0] : null;
    const balanceData = "Ok" in balanceResult ? balanceResult.Ok : null;

    return {
      profile: profile ? mapProfile(profile) : null,
      balance: balanceData ? mapBalance(balanceData) : null,
    };
  },
);
