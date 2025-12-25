import { unwrapResult } from "@volumetric/canister-types";
import { createApiHandler } from "@/lib/api-handler";
import { getCanisterActor } from "@/lib/canister-server";
import { TestingForceSettleRequestSchema, type TestingForceSettleResponse } from "./types";

export const POST = createApiHandler(
  TestingForceSettleRequestSchema,
  async ({ optionId }): Promise<TestingForceSettleResponse> => {
    const actor = await getCanisterActor();
    const result = await actor.testing_force_settle(BigInt(optionId));
    const settlement = unwrapResult(result);

    return {
      optionId: settlement.option_id.toString(),
      settlementPriceCents: settlement.settlement_price_cents.toString(),
      payoutToBuyer: settlement.payout_to_buyer.toString(),
      payoutToWriter: settlement.payout_to_writer.toString(),
    };
  },
);
