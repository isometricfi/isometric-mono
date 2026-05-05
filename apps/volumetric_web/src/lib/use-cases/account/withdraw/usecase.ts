import type { WithdrawStatus } from "@volumetric/canister-types";
import { unwrapResult } from "@volumetric/canister-types";
import { getCanisterActor } from "@/lib/canister-server";
import { bytesToHex } from "@/lib/ckbtc-minter-server";
import { getWithdrawalSyncRepository } from "@/lib/repositories/withdrawal-sync/get-withdrawal-sync-repository";
import type { TrackedWithdrawal } from "@/lib/repositories/withdrawal-sync/withdrawal-sync-repository.interface";
import { withSpan } from "@/lib/telemetry/withSpan";
import { mapCanisterWithdrawalPhase } from "../../_shared/map-canister-withdrawal-phase";
import { pollOperationStatusUntilTerminal } from "../../_shared/poll-operation-status";
import { toCanisterWalletProof } from "../../_shared/wallet-proof";
import { assertNotPaused } from "../../feature-flags/_shared/assert-not-paused";
import { mapResult } from "./mapper";
import type { Input, Output } from "./schema";

const WITHDRAW_SPAN_NAME = "usecase.account.withdraw";

export async function withdraw(input: Input): Promise<Output> {
  return withSpan(WITHDRAW_SPAN_NAME, async () => {
    await assertNotPaused();

    const actor = await getCanisterActor();

    const result = await actor.withdraw_ckbtc({
      data: {
        amount: BigInt(input.amount),
        expires_at_seconds: BigInt(input.expiresAtSeconds),
      },
      wallet_proof: toCanisterWalletProof(input),
    });

    const receipt = unwrapResult(result);
    const operationIdHex = bytesToHex(receipt.operation_id);
    const repository = getWithdrawalSyncRepository();
    const nowMs = Date.now();

    const initialRow: TrackedWithdrawal = {
      operationId: operationIdHex,
      userAddress: input.address,
      withdrawalId: Number(receipt.withdrawal_id),
      destinationAddress: input.address,
      amountSats: Number(input.amount),
      blockIndex: null,
      bitcoinTxid: null,
      confirmations: 0,
      phase: "started",
      lastError: null,
      syncAttemptCount: 0,
      nextSyncAtMs: nowMs,
      lastSyncAtMs: null,
      status: "broadcasting",
      createdAtMs: nowMs,
      updatedAtMs: nowMs,
    };
    await repository.saveTrackedWithdrawal(initialRow);

    let latestRow: TrackedWithdrawal = initialRow;

    return pollOperationStatusUntilTerminal<WithdrawStatus, Output>({
      getStatus: async () => {
        const withdrawStatusResult = await actor.get_withdraw_status(receipt.operation_id);
        const status = unwrapResult(withdrawStatusResult);

        if ("Pending" in status) {
          const mapped = mapCanisterWithdrawalPhase(status.Pending.phase);
          latestRow = {
            ...latestRow,
            phase: mapped.phase,
            blockIndex: mapped.blockIndex ?? latestRow.blockIndex,
            updatedAtMs: Date.now(),
          };
          await repository.saveTrackedWithdrawal(latestRow);
        }

        return status;
      },
      mapTerminalStatus: (status) => {
        if ("Succeeded" in status) {
          const blockIndex = Number(status.Succeeded.result.block_index);
          void repository
            .saveTrackedWithdrawal({
              ...latestRow,
              phase: "completed",
              blockIndex,
              status: "broadcasting",
              nextSyncAtMs: Date.now(),
              updatedAtMs: Date.now(),
            })
            .catch(() => undefined);
          return mapResult(status.Succeeded.result);
        }

        if ("Failed" in status) {
          void repository
            .saveTrackedWithdrawal({
              ...latestRow,
              phase: "failed",
              status: "failed",
              lastError: status.Failed.message,
              updatedAtMs: Date.now(),
            })
            .catch(() => undefined);
          throw new Error(status.Failed.message);
        }

        return null;
      },
    });
  });
}
