import { unwrapResult } from "@volumetric/canister-types";
import { getCanisterActor } from "@/lib/canister-server";
import { withSpan } from "@/lib/telemetry/withSpan";
import type { Input, Output } from "./schema";

const SET_ORACLE_PRICE_SPAN_NAME = "usecase.testing.set_oracle_price";

export async function setOraclePrice(input: Input): Promise<Output> {
  return withSpan(SET_ORACLE_PRICE_SPAN_NAME, async () => {
    const actor = await getCanisterActor();
    const result = await actor.set_oracle_price_config(BigInt(input.priceCents));
    unwrapResult(result);
    return { success: true };
  });
}
