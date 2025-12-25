import { unwrapResult } from "@volumetric/canister-types";
import { createApiHandler } from "@/lib/api-handler";
import { getCanisterActor } from "@/lib/canister-server";
import { SetOraclePriceRequestSchema, type SetOraclePriceResponse } from "./types";

export const POST = createApiHandler(
  SetOraclePriceRequestSchema,
  async ({ priceCents }): Promise<SetOraclePriceResponse> => {
    const actor = await getCanisterActor();
    const result = await actor.set_oracle_price(BigInt(priceCents));
    unwrapResult(result);

    return {
      success: true,
    };
  },
);
