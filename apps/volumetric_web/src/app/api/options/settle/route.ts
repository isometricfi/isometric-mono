import { unwrapResult } from "@volumetric/canister-types";
import { z } from "zod";
import { createApiHandler } from "@/lib/api-handler";
import { getCanisterActor } from "@/lib/canister-server";

const RequestSchema = z.object({
  optionId: z.string(),
});

export type SettleOptionRequest = z.infer<typeof RequestSchema>;

export type SettleOptionResponse = {
  optionId: string;
  settlementPriceCents: string;
  payoutToBuyer: string;
  payoutToWriter: string;
};

export const POST = createApiHandler(RequestSchema, async ({ optionId }) => {
  const actor = await getCanisterActor();
  const result = await actor.settle_option_by_id(BigInt(optionId));
  const settlement = unwrapResult(result);

  return {
    optionId: settlement.option_id.toString(),
    settlementPriceCents: settlement.settlement_price_cents.toString(),
    payoutToBuyer: settlement.payout_to_buyer.toString(),
    payoutToWriter: settlement.payout_to_writer.toString(),
  } satisfies SettleOptionResponse;
});
