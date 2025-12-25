import { unwrapResult } from "@volumetric/canister-types";
import { createApiHandler } from "@/lib/api-handler";
import { getCanisterActor } from "@/lib/canister-server";
import { mapBalance } from "./mapper";
import { BalanceRequestSchema, type BalanceResponse } from "./types";

export const POST = createApiHandler(
  BalanceRequestSchema,
  async ({ address }): Promise<BalanceResponse> => {
    const actor = await getCanisterActor();
    const result = await actor.get_ckbtc_balance(address);
    const balance = unwrapResult(result);

    return mapBalance(balance);
  },
);
