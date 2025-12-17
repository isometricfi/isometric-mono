import { unwrapResult } from "@volumetric/canister-types";
import { NextResponse } from "next/server";
import { z } from "zod";
import { validateRequest, withApiHandler } from "@/lib/api-handler";
import { getCanisterActor } from "@/lib/canister-server";

const RequestSchema = z.object({
  address: z.string().min(1),
});

export type GetDepositAddressRequest = z.infer<typeof RequestSchema>;

const ResponseSchema = z.object({
  btc_address: z.string(),
  account: z.object({
    owner: z.string(),
    subaccount: z.array(z.number()).nullable(),
  }),
});

export type GetDepositAddressResponse = z.infer<typeof ResponseSchema>;

export const POST = withApiHandler(async (request: Request) => {
  const { address } = await validateRequest(request, RequestSchema);
  const actor = await getCanisterActor();
  const result = await actor.get_deposit_address(address);

  const data = unwrapResult(result);

  return NextResponse.json({
    btc_address: data.btc_address,
    account: {
      owner: data.account.owner.toText(),
      subaccount: data.account.subaccount[0] ? Array.from(data.account.subaccount[0]) : null,
    },
  } satisfies GetDepositAddressResponse);
});
