import type { ProfileInfo, UserBalanceInfo } from "@volumetric/canister-types";
import type { BalanceData, ProfileData } from "./schema";

export function mapProfile(profile: ProfileInfo, inviteCode: string | null = null): ProfileData {
  return {
    address: profile.address,
    username: profile.username.length > 0 ? (profile.username[0] ?? null) : null,
    principal: profile.principal.toString(),
    inviteCode,
  };
}

export function mapBalance(balance: UserBalanceInfo): BalanceData {
  return {
    total: balance.total,
    available: balance.available,
    locked: balance.locked,
  };
}
