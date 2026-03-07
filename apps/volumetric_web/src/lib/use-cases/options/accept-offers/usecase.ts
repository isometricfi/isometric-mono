import { unwrapResult } from "@volumetric/canister-types";
import { getCanisterActor } from "@/lib/canister-server";
import { withSpan } from "@/lib/telemetry/withSpan";
import { mapResult } from "./mapper";
import type { Input, Output } from "./schema";

const ACCEPT_OFFERS_SPAN_NAME = "usecase.options.accept_offers";

export async function acceptOffers(input: Input): Promise<Output> {
  return withSpan(ACCEPT_OFFERS_SPAN_NAME, async () => {
    const actor = await getCanisterActor();

    const result = await actor.accept_offers({
      wallet_proof: { address: input.address, signature: input.signature },
      data: {
        items: input.items.map((item) => ({
          offer_id: BigInt(item.offerId),
          quantity: BigInt(item.quantity),
        })),
      },
    });

    const data = unwrapResult(result);
    return mapResult(data);
  });
}
