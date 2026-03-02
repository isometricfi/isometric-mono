import type { _SERVICE } from "@volumetric/canister-types";
import { describe, expect, test, vi } from "vitest";
import type {
  IDepositSyncRepository,
  TrackedDeposit,
} from "@/lib/repositories/deposit-sync/deposit-sync-repository.interface";
import { reconcileUserDepositsAfterSync } from "./reconciliation";

const TEST_USER_ADDRESS = "tb1quser";
const TEST_NOW_MS = 1_700_000_000_000;
const ZERO_BIGINT = BigInt(0);

function makeTrackedDeposit(overrides: Partial<TrackedDeposit> = {}): TrackedDeposit {
  return {
    key: "k1",
    userAddress: TEST_USER_ADDRESS,
    depositAddress: "tb1qdeposit",
    txid: "tx1",
    vout: 0,
    valueSats: 7_000,
    firstSeenAtMs: TEST_NOW_MS,
    firstSeenHeight: 180,
    confirmations: 8,
    syncAttemptCount: 0,
    nextSyncAtMs: TEST_NOW_MS,
    lastSyncAtMs: null,
    status: "matured",
    updatedAtMs: TEST_NOW_MS,
    ...overrides,
  };
}

function makeRepositoryMocks() {
  const repository: IDepositSyncRepository = {
    getTrackedDepositByKey: vi.fn(),
    saveTrackedDeposit: vi.fn(),
    listDueTrackedDeposits: vi.fn(),
    listUserPendingDeposits: vi.fn(),
    saveBalanceSnapshot: vi.fn(),
    getUserDepositAddress: vi.fn(),
    saveUserDepositAddress: vi.fn(),
  };
  return repository;
}

function makeActor() {
  return {
    get_user_balance: vi.fn(),
    update_ckbtc_balance: vi.fn(),
  } as unknown as _SERVICE;
}

describe("reconcileUserDepositsAfterSync", () => {
  test("should credit deposits when sync increases balance", async () => {
    // given
    const repository = makeRepositoryMocks();
    const actor = makeActor();
    const dueDeposit = makeTrackedDeposit({ key: "due-1", txid: "tx-a", valueSats: 4_000 });
    const pendingDeposit = makeTrackedDeposit({ key: "pending-1", txid: "tx-a", valueSats: 4_000 });

    vi.mocked(repository.listUserPendingDeposits).mockResolvedValue([pendingDeposit]);
    vi.mocked(actor.get_user_balance)
      .mockResolvedValueOnce({ Ok: { available: BigInt(1_000) } } as never)
      .mockResolvedValueOnce({ Ok: { available: BigInt(6_000) } } as never);
    vi.mocked(actor.update_ckbtc_balance).mockResolvedValue({ Ok: [] } as never);

    // when
    const result = await reconcileUserDepositsAfterSync({
      repository,
      actor,
      userAddress: TEST_USER_ADDRESS,
      dueDeposits: [dueDeposit],
      nowMs: TEST_NOW_MS,
      zeroBigInt: ZERO_BIGINT,
      maxSyncAttempts: 6,
      getBackoffDelayMs: (attempt) => attempt * 1_000,
    });

    // then
    expect(result).toEqual({
      syncCalls: 1,
      creditedDeposits: 1,
      snapshotsSaved: 1,
    });
    expect(repository.saveTrackedDeposit).toHaveBeenCalledWith(
      expect.objectContaining({
        key: "pending-1",
        status: "credited",
      }),
    );
    expect(repository.saveBalanceSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        userAddress: TEST_USER_ADDRESS,
        deltaSats: "5000",
      }),
    );
  });

  test("should apply backoff and keep deposit pending when sync does not credit", async () => {
    // given
    const repository = makeRepositoryMocks();
    const actor = makeActor();
    const dueDeposit = makeTrackedDeposit({
      key: "due-2",
      txid: "tx-b",
      syncAttemptCount: 2,
    });
    vi.mocked(repository.listUserPendingDeposits).mockResolvedValue([dueDeposit]);
    vi.mocked(actor.get_user_balance).mockResolvedValue({
      Ok: { available: BigInt(3_000) },
    } as never);
    vi.mocked(actor.update_ckbtc_balance).mockRejectedValue(new Error("sync failed"));

    // when
    const result = await reconcileUserDepositsAfterSync({
      repository,
      actor,
      userAddress: TEST_USER_ADDRESS,
      dueDeposits: [dueDeposit],
      nowMs: TEST_NOW_MS,
      zeroBigInt: ZERO_BIGINT,
      maxSyncAttempts: 6,
      getBackoffDelayMs: () => 8_000,
    });

    // then
    expect(result).toEqual({
      syncCalls: 1,
      creditedDeposits: 0,
      snapshotsSaved: 1,
    });
    expect(repository.saveTrackedDeposit).toHaveBeenCalledWith(
      expect.objectContaining({
        key: "due-2",
        status: "matured",
        syncAttemptCount: 3,
        nextSyncAtMs: TEST_NOW_MS + 8_000,
      }),
    );
    expect(repository.saveBalanceSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        deltaSats: "0",
      }),
    );
  });
});
