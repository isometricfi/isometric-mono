import type { SettlementResult } from "@volumetric/canister-types";
import type { SettleOptionResponse } from "./types";

export const mapSettlement = (settlement: SettlementResult): SettleOptionResponse => ({
  optionId: settlement.option_id.toString(),
  settlementPriceCents: settlement.settlement_price_cents,
  payoutToBuyer: settlement.payout_to_buyer,
  payoutToWriter: settlement.payout_to_writer,
});
