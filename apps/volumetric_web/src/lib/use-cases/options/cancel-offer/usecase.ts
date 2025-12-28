import { unwrapResult } from "@volumetric/canister-types";
import { getCanisterActor } from "@/lib/canister-server";
import type { Input, Output } from "./schema";

export async function cancelOffer(input: Input): Promise<Output> {
  const actor = await getCanisterActor();

  const result = await actor.cancel_offer({
    wallet_proof: { address: input.address, signature: input.signature },
    data: { offer_id: BigInt(input.offerId) },
  });

  unwrapResult(result);
  return { success: true };
}
