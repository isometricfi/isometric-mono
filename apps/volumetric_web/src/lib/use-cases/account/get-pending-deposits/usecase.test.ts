import { beforeEach, describe, expect, test, vi } from "vitest";
import type {
  IDepositSyncRepository,
  TrackedDeposit,
} from "@/lib/repositories/deposit-sync/deposit-sync-repository.interface";
import { getPendingDeposits } from "./usecase";

const USER_ADDRESS = "tb1quser";
const DEPOSIT_ADDRESS = "tb1qdeposit";

const { getDepositSyncRepositoryMock } = vi.hoisted(() => ({
  getDepositSyncRepositoryMock: vi.fn(),
}));

vi.mock("@/lib/repositories/deposit-sync/get-deposit-sync-repository", () => ({
  getDepositSyncRepository: getDepositSyncRepositoryMock,
}));

function makeTrackedDeposit(overrides: Partial<TrackedDeposit> = {}): TrackedDeposit {
  return {
    key: "k1",
    userAddress: USER_ADDRESS,
    depositAddress: DEPOSIT_ADDRESS,
    txid: "tx1",
    vout: 0,
    valueSats: 7_000,
    firstSeenAtMs: 1_700_000_000_000,
    firstSeenHeight: 180,
    confirmations: 4,
    syncAttemptCount: 0,
    nextSyncAtMs: 1_700_000_060_000,
    lastSyncAtMs: null,
    status: "matured",
    updatedAtMs: 1_700_000_000_000,
    ...overrides,
  };
}

function makeRepositoryMock(): IDepositSyncRepository {
  return {
    getTrackedDepositByKey: vi.fn(),
    saveTrackedDeposit: vi.fn(),
    listDueTrackedDeposits: vi.fn(),
    listUserPendingDeposits: vi.fn(),
    saveBalanceSnapshot: vi.fn(),
    getUserDepositAddress: vi.fn(),
    saveUserDepositAddress: vi.fn(),
  };
}

describe("getPendingDeposits", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("should return sorted pending deposits for a user", async () => {
    // given
    const repository = makeRepositoryMock();
    vi.mocked(repository.listUserPendingDeposits).mockResolvedValue([
      makeTrackedDeposit({
        key: "k-late",
        txid: "tx-late",
        vout: 1,
        firstSeenAtMs: 1_700_000_020_000,
        status: "syncing",
      }),
      makeTrackedDeposit({
        key: "k-early",
        txid: "tx-early",
        vout: 0,
        firstSeenAtMs: 1_700_000_010_000,
        status: "matured",
      }),
    ]);
    getDepositSyncRepositoryMock.mockReturnValue(repository);

    // when
    const result = await getPendingDeposits(USER_ADDRESS);

    // then
    expect(repository.listUserPendingDeposits).toHaveBeenCalledWith(USER_ADDRESS);
    expect(result.requiredConfirmations).toBe(4);
    expect(result.pendingDeposits).toHaveLength(2);
    expect(result.pendingDeposits[0]?.txid).toBe("tx-early");
    expect(result.pendingDeposits[0]?.status).toBe("matured");
    expect(result.pendingDeposits[1]?.txid).toBe("tx-late");
    expect(result.pendingDeposits[1]?.status).toBe("syncing");
  });

  test("should return empty list when user has no pending deposits", async () => {
    // given
    const repository = makeRepositoryMock();
    vi.mocked(repository.listUserPendingDeposits).mockResolvedValue([]);
    getDepositSyncRepositoryMock.mockReturnValue(repository);

    // when
    const result = await getPendingDeposits(USER_ADDRESS);

    // then
    expect(result).toEqual({
      requiredConfirmations: 4,
      pendingDeposits: [],
    });
  });
});
