import { unwrapResult } from "@volumetric/canister-types";
import { getCanisterActor } from "@/lib/canister-server";
import { mapResult } from "./mapper";
import type { Output } from "./schema";

export async function getDepositAddress(address: string): Promise<Output> {
  const actor = await getCanisterActor();
  const result = await actor.get_deposit_address(address);
  const data = unwrapResult(result);
  return mapResult(data);
}
