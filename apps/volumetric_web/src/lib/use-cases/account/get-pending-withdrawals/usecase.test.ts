import { beforeEach, describe, expect, test, vi } from "vitest";
import type { TrackedWithdrawal } from "@/lib/repositories/withdrawal-sync/withdrawal-sync-repository.interface";
import { getPendingWithdrawals } from "./usecase";

const { listUserPendingWithdrawalsMock } = vi.hoisted(() => ({
  listUserPendingWithdrawalsMock: vi.fn(),
}));

vi.mock("@/lib/repositories/withdrawal-sync/get-withdrawal-sync-repository", () => ({
  getWithdrawalSyncRepository: () => ({
    listUserPendingWithdrawals: listUserPendingWithdrawalsMock,
  }),
}));

function makeRow(overrides: Partial<TrackedWithdrawal>): TrackedWithdrawal {
  return {
    operationId: "deadbeef",
    userAddress: "tb1quser",
    withdrawalId: 1,
    destinationAddress: "tb1qdest",
    amountSats: 1000,
    blockIndex: null,
    bitcoinTxid: null,
    confirmations: 0,
    phase: "started",
    lastError: null,
    syncAttemptCount: 0,
    nextSyncAtMs: 0,
    lastSyncAtMs: null,
    status: "broadcasting",
    createdAtMs: 0,
    updatedAtMs: 0,
    ...overrides,
  };
}

describe("getPendingWithdrawals usecase", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("sorts results by createdAtMs ascending and exposes required confirmations", async () => {
    listUserPendingWithdrawalsMock.mockResolvedValue([
      makeRow({ operationId: "b", createdAtMs: 200 }),
      makeRow({ operationId: "a", createdAtMs: 100 }),
    ]);

    const result = await getPendingWithdrawals("tb1quser");

    expect(result.requiredConfirmations).toBe(1);
    expect(result.pendingWithdrawals.map((row) => row.operationId)).toEqual(["a", "b"]);
  });

  test("maps pending status to 'pending' once a bitcoin txid is present", async () => {
    listUserPendingWithdrawalsMock.mockResolvedValue([
      makeRow({ status: "pending", bitcoinTxid: "abcd", confirmations: 0 }),
    ]);

    const result = await getPendingWithdrawals("tb1quser");

    expect(result.pendingWithdrawals[0]).toMatchObject({
      status: "pending",
      bitcoinTxid: "abcd",
      confirmations: 0,
    });
  });
});
