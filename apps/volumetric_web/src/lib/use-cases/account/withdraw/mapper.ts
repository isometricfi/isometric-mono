import type { WithdrawResult } from "@volumetric/canister-types";
import type { Output } from "./schema";

export function mapResult(result: WithdrawResult): Output {
  return {
    blockIndex: result.block_index,
  };
}
