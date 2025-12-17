import { unwrapResult } from "@volumetric/canister-types";
import { NextResponse } from "next/server";
import { z } from "zod";
import { validateRequest, withApiHandler } from "@/lib/api-handler";
import { getCanisterActor } from "@/lib/canister-server";

const RequestSchema = z.object({
  optionId: z.string(),
});

export type TestingExpireOptionRequest = z.infer<typeof RequestSchema>;

export type TestingExpireOptionResponse = {
  optionId: string;
  expiry: string;
};

export const POST = withApiHandler(async (request: Request) => {
  const { optionId } = await validateRequest(request, RequestSchema);
  const actor = await getCanisterActor();
  const result = await actor.testing_expire_option(BigInt(optionId));
  const option = unwrapResult(result);

  return NextResponse.json({
    optionId: option.id.toString(),
    expiry: option.expiry.toString(),
  } satisfies TestingExpireOptionResponse);
});
