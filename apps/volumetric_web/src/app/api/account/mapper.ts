import type { ProfileInfo, UserBalanceInfo } from "@volumetric/canister-types";
import type { BalanceData, ProfileData } from "./types";

export const mapProfile = (profile: ProfileInfo): ProfileData => ({
  address: profile.address,
  username: profile.username.length > 0 ? (profile.username[0] ?? null) : null,
  principal: profile.principal.toString(),
});

export const mapBalance = (balance: UserBalanceInfo): BalanceData => ({
  total: balance.total,
  available: balance.available,
  locked: balance.locked,
});
