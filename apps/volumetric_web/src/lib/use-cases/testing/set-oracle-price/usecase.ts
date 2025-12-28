import { unwrapResult } from "@volumetric/canister-types";
import { getCanisterActor } from "@/lib/canister-server";
import type { Input, Output } from "./schema";

export async function setOraclePrice(input: Input): Promise<Output> {
  const actor = await getCanisterActor();
  const result = await actor.set_oracle_price(BigInt(input.priceCents));
  unwrapResult(result);
  return { success: true };
}
