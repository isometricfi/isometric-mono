import { unwrapResult } from "@volumetric/canister-types";
import { z } from "zod";
import { createApiHandler } from "@/lib/api-handler";
import { getCanisterActor } from "@/lib/canister-server";

const AcceptOfferItemSchema = z.object({
  offerId: z.string(),
  quantity: z.string(),
});

const RequestSchema = z.object({
  address: z.string().min(1),
  signature: z.string().min(1),
  items: z.array(AcceptOfferItemSchema).min(1),
});

export type AcceptOffersRequest = z.infer<typeof RequestSchema>;

export type AcceptOffersResponse = {
  fillGroupId: string;
  activeOptionIds: string[];
};

export const POST = createApiHandler(RequestSchema, async ({ address, signature, items }) => {
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

  return {
    fillGroupId: data.fill_group_id.toString(),
    activeOptionIds: data.active_options.map((o) => o.id.toString()),
  } satisfies AcceptOffersResponse;
});
