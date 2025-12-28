import { getCanisterActor } from "@/lib/canister-server";
import { mapBalance, mapProfile } from "./mapper";
import type { Output } from "./schema";

export async function getAccount(address: string): Promise<Output> {
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
}
