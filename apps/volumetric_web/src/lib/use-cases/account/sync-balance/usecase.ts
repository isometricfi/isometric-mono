import { unwrapResult } from "@volumetric/canister-types";
import { getCanisterActor } from "@/lib/canister-server";
import { withSpan } from "@/lib/telemetry/withSpan";
import type { Output } from "./schema";

const SYNC_BALANCE_SPAN_NAME = "usecase.account.sync_balance";

export async function syncBalance(address: string): Promise<Output> {
  return withSpan(SYNC_BALANCE_SPAN_NAME, async () => {
    const actor = await getCanisterActor();
    const result = await actor.update_ckbtc_balance(address);
    unwrapResult(result);
    return { success: true };
  });
}
