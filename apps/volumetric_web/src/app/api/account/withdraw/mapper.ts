import type { WithdrawResult } from "@volumetric/canister-types";
import type { WithdrawResponse } from "./types";

export const mapWithdraw = (result: WithdrawResult): WithdrawResponse => ({
  blockIndex: result.block_index,
});
