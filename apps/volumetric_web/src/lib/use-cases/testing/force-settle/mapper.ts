import type { SettlementWalResult } from "@volumetric/canister-types";
import type { Output } from "./schema";

export function mapResult(settlement: SettlementWalResult): Output {
  return {
    optionId: settlement.option_id.toString(),
    status: "succeeded",
  };
}
