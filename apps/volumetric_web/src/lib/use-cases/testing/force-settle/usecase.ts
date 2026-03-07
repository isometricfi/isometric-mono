import { unwrapResult } from "@volumetric/canister-types";
import { getCanisterActor } from "@/lib/canister-server";
import { withSpan } from "@/lib/telemetry/withSpan";
import { mapResult } from "./mapper";
import type { Input, Output } from "./schema";

const FORCE_SETTLE_SPAN_NAME = "usecase.testing.force_settle";

export async function forceSettle(input: Input): Promise<Output> {
  return withSpan(FORCE_SETTLE_SPAN_NAME, async () => {
    const actor = await getCanisterActor();
    const result = await actor.testing_force_settle(BigInt(input.optionId));
    const settlement = unwrapResult(result);
    return mapResult(settlement);
  });
}
