import { unwrapResult } from "@volumetric/canister-types";
import { getCanisterActor } from "@/lib/canister-server";
import { mapResult } from "./mapper";
import type { Input, Output } from "./schema";

export async function forceSettle(input: Input): Promise<Output> {
  const actor = await getCanisterActor();
  const result = await actor.testing_force_settle(BigInt(input.optionId));
  const settlement = unwrapResult(result);
  return mapResult(settlement);
}
