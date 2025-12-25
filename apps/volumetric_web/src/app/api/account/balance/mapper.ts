import type { BalanceResponse } from "./types";

export const mapBalance = (balance: bigint): BalanceResponse => ({
  balance,
});
