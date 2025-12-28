import type { SettlementResult } from "@volumetric/canister-types";
import type { Output } from "./schema";

export function mapResult(settlement: SettlementResult): Output {
  return {
    optionId: settlement.option_id.toString(),
    settlementPriceCents: settlement.settlement_price_cents.toString(),
    payoutToBuyer: settlement.payout_to_buyer.toString(),
    payoutToWriter: settlement.payout_to_writer.toString(),
  };
}
