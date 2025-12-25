import { unwrapResult } from "@volumetric/canister-types";
import { createApiHandler } from "@/lib/api-handler";
import { getCanisterActor } from "@/lib/canister-server";
import { mapCancelOffer } from "./mapper";
import { CancelOfferRequestSchema, type CancelOfferResponse } from "./types";

export const POST = createApiHandler(
  CancelOfferRequestSchema,
  async ({ address, signature, offerId }): Promise<CancelOfferResponse> => {
    const actor = await getCanisterActor();

    const result = await actor.cancel_offer({
      wallet_proof: { address, signature },
      data: { offer_id: BigInt(offerId) },
    });

    unwrapResult(result);

    return mapCancelOffer();
  },
);
