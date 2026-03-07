import { unwrapResult } from "@volumetric/canister-types";
import { getCanisterActor } from "@/lib/canister-server";
import { withSpan } from "@/lib/telemetry/withSpan";
import type { Input, Output } from "./schema";

const CANCEL_OFFER_SPAN_NAME = "usecase.options.cancel_offer";

export async function cancelOffer(input: Input): Promise<Output> {
  return withSpan(CANCEL_OFFER_SPAN_NAME, async () => {
    const actor = await getCanisterActor();

    const result = await actor.cancel_offer({
      wallet_proof: { address: input.address, signature: input.signature },
      data: { offer_id: BigInt(input.offerId) },
    });

    unwrapResult(result);
    return { success: true };
  });
}
