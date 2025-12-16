import { unwrapResult } from "@volumetric/canister-types";
import { z } from "zod";
import { createApiHandler } from "@/lib/api-handler";
import { getCanisterActor } from "@/lib/canister-server";

const RequestSchema = z.object({
  address: z.string().min(1),
  signature: z.string().min(1),
  quantity: z.string(),
  strikeBasisPoints: z.number(),
  premiumBasisPoints: z.number(),
  offerValidUntil: z.string(),
  optionDurationSeconds: z.string(),
});

export type CreateOfferRequest = z.infer<typeof RequestSchema>;

export type CreateOfferResponse = {
  offerId: string;
};

export const POST = createApiHandler(
  RequestSchema,
  async ({
    address,
    signature,
    quantity,
    strikeBasisPoints,
    premiumBasisPoints,
    offerValidUntil,
    optionDurationSeconds,
  }) => {
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

    return {
      offerId: data.offer.id.toString(),
    } satisfies CreateOfferResponse;
  },
);
