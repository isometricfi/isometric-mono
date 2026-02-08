import type { WithdrawResult } from "@volumetric/canister-types";
import { expect, test } from "vitest";
import { mapResult } from "./mapper";

test("should map withdraw result", () => {
  // given
  const BLOCK_INDEX = BigInt(12345);
  const input: WithdrawResult = { block_index: BLOCK_INDEX };

  // when
  const result = mapResult(input);

  // then
  expect(result).toEqual({ blockIndex: BLOCK_INDEX });
});
