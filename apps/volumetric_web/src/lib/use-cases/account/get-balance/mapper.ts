import type { UserBalanceInfo } from "@volumetric/canister-types";
import type { Output } from "./schema";

export function mapBalance(balance: UserBalanceInfo): Output {
  return {
    total: balance.total,
    available: balance.available,
    locked: balance.locked,
    maxWithdrawSats: balance.max_withdraw_sats,
  };
}
