import { unwrapResult } from "@volumetric/canister-types";
import { createApiHandler } from "@/lib/api-handler";
import { getCanisterActor } from "@/lib/canister-server";
import { mapSyncBalance } from "./mapper";
import { SyncBalanceRequestSchema, type SyncBalanceResponse } from "./types";

export const POST = createApiHandler(
  SyncBalanceRequestSchema,
  async ({ address }): Promise<SyncBalanceResponse> => {
    const actor = await getCanisterActor();
    const result = await actor.update_ckbtc_balance(address);
    unwrapResult(result);

    return mapSyncBalance();
  },
);
