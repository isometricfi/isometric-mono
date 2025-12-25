import { unwrapResult } from "@volumetric/canister-types";
import { createApiHandler } from "@/lib/api-handler";
import { getCanisterActor } from "@/lib/canister-server";
import { mapCreateOffer } from "./mapper";
import { CreateOfferRequestSchema, type CreateOfferResponse } from "./types";

export const POST = createApiHandler(
  CreateOfferRequestSchema,
  async ({
    address,
    signature,
    quantity,
    strikeBasisPoints,
    premiumBasisPoints,
    offerValidUntil,
    optionDurationSeconds,
  }): Promise<CreateOfferResponse> => {
    const actor = await getCanisterActor();
    const result = await actor.create_offer({
      wallet_proof: { address, signature },
      data: {
        asset: { CkBtc: null },
        option_type: { Call: null },
        quantity: BigInt(quantity),
        strike_basis_points: strikeBasisPoints,
        premium_basis_points: premiumBasisPoints,
        offer_valid_until: BigInt(offerValidUntil),
        option_duration_seconds: BigInt(optionDurationSeconds),
      },
    });

    const data = unwrapResult(result);

    return mapCreateOffer(data);
  },
);
