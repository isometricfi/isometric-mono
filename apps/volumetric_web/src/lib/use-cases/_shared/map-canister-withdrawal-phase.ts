import type { WithdrawalPhase as CanisterWithdrawalPhase } from "@volumetric/canister-types";
import type { WithdrawalPhase as TrackedWithdrawalPhase } from "@/lib/repositories/withdrawal-sync/withdrawal-sync-repository.interface";

export interface MappedWithdrawalPhase {
  phase: TrackedWithdrawalPhase;
  blockIndex: number | null;
}

export function mapCanisterWithdrawalPhase(phase: CanisterWithdrawalPhase): MappedWithdrawalPhase {
  if ("Started" in phase) return { phase: "started", blockIndex: null };
  if ("Approved" in phase) return { phase: "approved", blockIndex: null };
  if ("RetrieveRequested" in phase) {
    return {
      phase: "retrieve_requested",
      blockIndex: Number(phase.RetrieveRequested.block_index),
    };
  }
  if ("Completed" in phase) {
    return { phase: "completed", blockIndex: Number(phase.Completed.block_index) };
  }
  return { phase: "started", blockIndex: null };
}
