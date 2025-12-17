import { unwrapResult } from "@volumetric/canister-types";
import { NextResponse } from "next/server";
import { z } from "zod";
import { validateRequest, withApiHandler } from "@/lib/api-handler";
import { getCanisterActor } from "@/lib/canister-server";

const RequestSchema = z.object({
  address: z.string().min(1),
});

export type GetCkbtcBalanceRequest = z.infer<typeof RequestSchema>;

const ResponseSchema = z.object({
  balance: z.string(),
});

export type GetCkbtcBalanceResponse = z.infer<typeof ResponseSchema>;

export const POST = withApiHandler(async (request: Request) => {
  const { address } = await validateRequest(request, RequestSchema);
  const actor = await getCanisterActor();
  const result = await actor.get_ckbtc_balance(address);

  const balance = unwrapResult(result);

  return NextResponse.json({ balance: balance.toString() } satisfies GetCkbtcBalanceResponse);
});
