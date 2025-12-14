import { unwrapResult } from "@volumetric/canister-types";
import { z } from "zod";
import { createApiHandler } from "@/lib/api-handler";
import { getCanisterActor } from "@/lib/canister-server";

const RequestSchema = z.object({
  address: z.string().min(1),
});

export type GetCkbtcBalanceRequest = z.infer<typeof RequestSchema>;

const ResponseSchema = z.object({
  balance: z.string(),
});

export type GetCkbtcBalanceResponse = z.infer<typeof ResponseSchema>;

export const POST = createApiHandler(RequestSchema, async ({ address }) => {
  const actor = await getCanisterActor();
  const result = await actor.get_ckbtc_balance(address);

  const balance = unwrapResult(result);

  return { balance: balance.toString() } satisfies GetCkbtcBalanceResponse;
});
