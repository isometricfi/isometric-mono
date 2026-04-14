import type { UserBalanceInfo } from "@volumetric/canister-types";
import { expect, test } from "vitest";
import { mapBalance } from "./mapper";

test("should map all balance fields", () => {
  // given
  const TOTAL = BigInt(500_000);
  const AVAILABLE = BigInt(300_000);
  const LOCKED = BigInt(200_000);
  const input: UserBalanceInfo = {
    total: TOTAL,
    available: AVAILABLE,
    locked: LOCKED,
  };

  // when
  const result = mapBalance(input);

  // then
  expect(result).toEqual({
    total: TOTAL,
    available: AVAILABLE,
    locked: LOCKED,
  });
});
