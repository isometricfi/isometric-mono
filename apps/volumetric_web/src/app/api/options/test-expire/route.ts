import { unwrapResult } from "@volumetric/canister-types";
import { createApiHandler } from "@/lib/api-handler";
import { getCanisterActor } from "@/lib/canister-server";
import { TestingExpireOptionRequestSchema, type TestingExpireOptionResponse } from "./types";

export const POST = createApiHandler(
  TestingExpireOptionRequestSchema,
  async ({ optionId }): Promise<TestingExpireOptionResponse> => {
    const actor = await getCanisterActor();
    const result = await actor.testing_expire_option(BigInt(optionId));
    const option = unwrapResult(result);

    return {
      optionId: option.id.toString(),
      expiry: option.expiry.toString(),
    };
  },
);
