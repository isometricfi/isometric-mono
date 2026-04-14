import { profileFromGetAccountInfoResult } from "@volumetric/canister-types";
import { getCanisterActor } from "@/lib/canister-server";
import { withSpan } from "@/lib/telemetry/withSpan";
import { mapBalance, mapProfile } from "./mapper";
import type { Output } from "./schema";

const GET_ACCOUNT_SPAN_NAME = "usecase.account.get_account";

export async function getAccount(address: string): Promise<Output> {
  return withSpan(GET_ACCOUNT_SPAN_NAME, async () => {
    const actor = await getCanisterActor();

    const [profileResult, balanceResult, inviteCodeResult, referralCountResult] = await Promise.all(
      [
        actor.get_account_info(address),
        actor.get_user_balance(address),
        actor.get_invite_code(address),
        actor.get_referral_count(address),
      ],
    );

    const profile = profileFromGetAccountInfoResult(profileResult);
    const balanceData = "Ok" in balanceResult ? balanceResult.Ok : null;
    const inviteCode = inviteCodeResult[0] ?? null;
    const referrals = referralCountResult[0] ?? BigInt(0);

    return {
      profile: profile ? mapProfile(profile, inviteCode) : null,
      balance: balanceData ? mapBalance(balanceData) : null,
      referrals,
    };
  });
}
