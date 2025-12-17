import { unwrapResult } from "@volumetric/canister-types";
import { NextResponse } from "next/server";
import { z } from "zod";
import { validateRequest, withApiHandler } from "@/lib/api-handler";
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

export const POST = withApiHandler(async (request: Request) => {
  const {
    address,
    signature,
    quantity,
    strikeBasisPoints,
    premiumBasisPoints,
    offerValidUntil,
    optionDurationSeconds,
  } = await validateRequest(request, RequestSchema);
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

  return NextResponse.json({
    offerId: data.offer.id.toString(),
  } satisfies CreateOfferResponse);
});
