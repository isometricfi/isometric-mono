import { unwrapResult } from "@volumetric/canister-types";
import { NextResponse } from "next/server";
import { z } from "zod";
import { validateRequest, withApiHandler } from "@/lib/api-handler";
import { getCanisterActor } from "@/lib/canister-server";

const RequestSchema = z.object({
  priceCents: z.string(),
});

export type SetOraclePriceRequest = z.infer<typeof RequestSchema>;

export type SetOraclePriceResponse = {
  success: boolean;
};

export const POST = withApiHandler(async (request: Request) => {
  const { priceCents } = await validateRequest(request, RequestSchema);
  const actor = await getCanisterActor();
  const result = await actor.set_oracle_price(BigInt(priceCents));
  unwrapResult(result);

  return NextResponse.json({
    success: true,
  } satisfies SetOraclePriceResponse);
});
