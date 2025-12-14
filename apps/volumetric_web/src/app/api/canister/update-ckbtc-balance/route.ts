import { unwrapResult } from "@volumetric/canister-types";
import { z } from "zod";
import { createApiHandler } from "@/lib/api-handler";
import { getCanisterActor } from "@/lib/canister-server";

const RequestSchema = z.object({
  address: z.string().min(1),
});

export type UpdateCkbtcBalanceRequest = z.infer<typeof RequestSchema>;

export const POST = createApiHandler(RequestSchema, async ({ address }) => {
  const actor = await getCanisterActor();
  const result = await actor.update_ckbtc_balance(address);
  return unwrapResult(result);
});
