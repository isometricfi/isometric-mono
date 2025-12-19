import { unwrapResult } from "@volumetric/canister-types";
import { z } from "zod";
import { createApiHandler } from "@/lib/api-handler";
import { getCanisterActor } from "@/lib/canister-server";

const RequestSchema = z.object({
  priceCents: z.string(),
});

export type SetOraclePriceRequest = z.infer<typeof RequestSchema>;

export type SetOraclePriceResponse = {
  success: boolean;
};

export const POST = createApiHandler(RequestSchema, async ({ priceCents }) => {
  const actor = await getCanisterActor();
  const result = await actor.set_oracle_price(BigInt(priceCents));
  unwrapResult(result);

  return {
    success: true,
  } satisfies SetOraclePriceResponse;
});
