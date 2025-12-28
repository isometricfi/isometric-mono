import { unwrapResult } from "@volumetric/canister-types";
import { getCanisterActor } from "@/lib/canister-server";
import type { Output } from "./schema";

export async function syncBalance(address: string): Promise<Output> {
  const actor = await getCanisterActor();
  const result = await actor.update_ckbtc_balance(address);
  unwrapResult(result);
  return { success: true };
}
