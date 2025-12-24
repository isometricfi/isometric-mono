import { unwrapResult } from "@volumetric/canister-types";
import { z } from "zod";
import { createApiHandler } from "@/lib/api-handler";
import { getCanisterActor } from "@/lib/canister-server";

const RequestSchema = z.object({
  address: z.string().min(1),
  signature: z.string().min(1),
  offerId: z.string(),
});

export type CancelOfferRequest = z.infer<typeof RequestSchema>;

export type CancelOfferResponse = {
  success: boolean;
};

export const POST = createApiHandler(RequestSchema, async ({ address, signature, offerId }) => {
  const actor = await getCanisterActor();

  const result = await actor.cancel_offer({
    wallet_proof: { address, signature },
    data: { offer_id: BigInt(offerId) },
  });

  unwrapResult(result);

  return {
    success: true,
  } satisfies CancelOfferResponse;
});
