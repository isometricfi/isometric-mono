import { unwrapResult } from "@volumetric/canister-types";
import { getCanisterActor } from "@/lib/canister-server";
import { getDepositSyncRepository } from "@/lib/repositories/deposit-sync/get-deposit-sync-repository";
import { withSpan } from "@/lib/telemetry/withSpan";
import { toCanisterWalletProof } from "../../_shared/wallet-proof";
import { assertNotPaused } from "../../feature-flags/_shared/assert-not-paused";
import { mapResult } from "./mapper";
import type { Input, Output } from "./schema";

const CREATE_ACCOUNT_SPAN_NAME = "usecase.account.create_account";

export async function createAccount(input: Input): Promise<Output> {
  return withSpan(CREATE_ACCOUNT_SPAN_NAME, async (span) => {
    await assertNotPaused();

    const actor = await getCanisterActor();
    const repository = getDepositSyncRepository();

    const result = await actor.create_account({
      data: {
        invite_code: input.inviteCode ? [input.inviteCode] : [],
        expires_at_seconds: BigInt(input.expiresAtSeconds),
      },
      wallet_proof: toCanisterWalletProof(input),
    });

    try {
      const depositAddressResult = await actor.get_deposit_address(input.address);
      const depositAddressData = unwrapResult(depositAddressResult);
      await repository.saveUserDepositAddress({
        userAddress: input.address,
        depositAddress: depositAddressData.btc_address,
        updatedAtMs: Date.now(),
      });
    } catch (error) {
      span.recordException(error instanceof Error ? error : new Error(String(error)));
    }

    const data = unwrapResult(result);
    return mapResult(data);
  });
}
