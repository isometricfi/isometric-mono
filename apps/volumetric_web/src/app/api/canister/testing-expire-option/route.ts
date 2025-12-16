import { unwrapResult } from "@volumetric/canister-types";
import { z } from "zod";
import { createApiHandler } from "@/lib/api-handler";
import { getCanisterActor } from "@/lib/canister-server";

const RequestSchema = z.object({
  optionId: z.string(),
});

export type TestingExpireOptionRequest = z.infer<typeof RequestSchema>;

export type TestingExpireOptionResponse = {
  optionId: string;
  expiry: string;
};

export const POST = createApiHandler(RequestSchema, async ({ optionId }) => {
  const actor = await getCanisterActor();
  const result = await actor.testing_expire_option(BigInt(optionId));
  const option = unwrapResult(result);

  return {
    optionId: option.id.toString(),
    expiry: option.expiry.toString(),
  } satisfies TestingExpireOptionResponse;
});
