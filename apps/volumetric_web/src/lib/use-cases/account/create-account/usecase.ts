import { unwrapResult } from "@volumetric/canister-types";
import { getCanisterActor } from "@/lib/canister-server";
import { getDepositSyncRepository } from "@/lib/repositories/deposit-sync/get-deposit-sync-repository";
import { withSpan } from "@/lib/telemetry/withSpan";
import { mapResult } from "./mapper";
import type { Input, Output } from "./schema";

const CREATE_ACCOUNT_SPAN_NAME = "usecase.account.create_account";

export async function createAccount(input: Input): Promise<Output> {
  return withSpan(CREATE_ACCOUNT_SPAN_NAME, async () => {
    const actor = await getCanisterActor();
    const repository = getDepositSyncRepository();

    const result = await actor.create_account({
      data: {},
      wallet_proof: { address: input.address, signature: input.signature },
    });

    try {
      const depositAddressResult = await actor.get_deposit_address(input.address);
      const depositAddressData = unwrapResult(depositAddressResult);
      await repository.saveUserDepositAddress({
        userAddress: input.address,
        depositAddress: depositAddressData.btc_address,
        updatedAtMs: Date.now(),
      });
    } catch {}

    const data = unwrapResult(result);
    return mapResult(data);
  });
}
