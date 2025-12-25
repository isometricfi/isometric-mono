import { unwrapResult } from "@volumetric/canister-types";
import { getCanisterActor } from "@/lib/canister-server";
import { mapResult } from "./mapper";
import type { Input, Output } from "./schema";

export async function createAccount(input: Input): Promise<Output> {
  const actor = await getCanisterActor();

  const result = await actor.create_account({
    data: {},
    wallet_proof: { address: input.address, signature: input.signature },
  });

  const data = unwrapResult(result);
  return mapResult(data);
}
