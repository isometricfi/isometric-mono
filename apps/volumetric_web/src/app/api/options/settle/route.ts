import { unwrapResult } from "@volumetric/canister-types";
import { createApiHandler } from "@/lib/api-handler";
import { getCanisterActor } from "@/lib/canister-server";
import { mapSettlement } from "./mapper";
import { SettleOptionRequestSchema, type SettleOptionResponse } from "./types";

export const POST = createApiHandler(
  SettleOptionRequestSchema,
  async ({ optionId }): Promise<SettleOptionResponse> => {
    const actor = await getCanisterActor();
    const result = await actor.settle_option_by_id(BigInt(optionId));
    const settlement = unwrapResult(result);

    return mapSettlement(settlement);
  },
);
