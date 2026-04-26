import { unwrapResult } from "@volumetric/canister-types";
import { getCanisterActor } from "@/lib/canister-server";
import { withSpan } from "@/lib/telemetry/withSpan";
import type { Input, Output } from "./schema";

const SET_ORACLE_PRICE_SPAN_NAME = "usecase.testing.set_oracle_price_cents";

type VolumetricActor = Awaited<ReturnType<typeof getCanisterActor>>;
type VolumetricActorWithTesting = VolumetricActor & {
  testing_set_oracle_price_cents: VolumetricActor["set_deposit_amount_sats_config"];
};

export async function setOraclePrice(input: Input): Promise<Output> {
  return withSpan(SET_ORACLE_PRICE_SPAN_NAME, async () => {
    const actor = (await getCanisterActor()) as VolumetricActorWithTesting;
    const result = await actor.testing_set_oracle_price_cents(BigInt(input.priceCents));
    unwrapResult(result);
    return { success: true };
  });
}
