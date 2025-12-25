import { unwrapResult } from "@volumetric/canister-types";
import { createApiHandler } from "@/lib/api-handler";
import { getCanisterActor } from "@/lib/canister-server";
import { mapAcceptOffers } from "./mapper";
import { AcceptOffersRequestSchema, type AcceptOffersResponse } from "./types";

export const POST = createApiHandler(
  AcceptOffersRequestSchema,
  async ({ address, signature, items }): Promise<AcceptOffersResponse> => {
    const actor = await getCanisterActor();

    const result = await actor.accept_offers({
      wallet_proof: { address, signature },
      data: {
        items: items.map((item) => ({
          offer_id: BigInt(item.offerId),
          quantity: BigInt(item.quantity),
        })),
      },
    });

    const data = unwrapResult(result);

    return mapAcceptOffers(data);
  },
);
