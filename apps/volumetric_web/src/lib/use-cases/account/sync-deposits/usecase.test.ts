import { beforeEach, describe, expect, test, vi } from "vitest";
import type {
  BalanceSnapshot,
  IDepositSyncRepository,
  TrackedDeposit,
} from "@/lib/repositories/deposit-sync/deposit-sync-repository.interface";
import { syncDepositsFromCanister } from "./usecase";

const USER_ADDRESS = "tb1quser";
const DEPOSIT_ADDRESS = "tb1qdeposit";

const { getCanisterActorMock } = vi.hoisted(() => ({
  getCanisterActorMock: vi.fn(),
}));
const { getDepositSyncRepositoryMock } = vi.hoisted(() => ({
  getDepositSyncRepositoryMock: vi.fn(),
}));

vi.mock("@/lib/canister-server", () => ({
  getCanisterActor: getCanisterActorMock,
}));

vi.mock("@/lib/repositories/deposit-sync/get-deposit-sync-repository", () => ({
  getDepositSyncRepository: getDepositSyncRepositoryMock,
}));

class InMemoryDepositSyncRepository implements IDepositSyncRepository {
  private tracked = new Map<string, TrackedDeposit>();
  private snapshots: BalanceSnapshot[] = [];
  private userDepositAddresses = new Map<string, { depositAddress: string; updatedAtMs: number }>();
  private cursor: { lastProcessedBlockHeight: number; updatedAtMs: number } | null = null;

  async getTrackedDepositByKey(key: string): Promise<TrackedDeposit | null> {
    return this.tracked.get(key) ?? null;
  }

  async saveTrackedDeposit(deposit: TrackedDeposit): Promise<void> {
    this.tracked.set(deposit.key, deposit);
  }

  async listDueTrackedDeposits(nowMs: number, limit: number): Promise<TrackedDeposit[]> {
    return Array.from(this.tracked.values())
      .filter(
        (deposit) =>
          (deposit.status === "matured" || deposit.status === "syncing") &&
          deposit.nextSyncAtMs <= nowMs,
      )
      .slice(0, limit);
  }

  async listUserPendingDeposits(userAddress: string): Promise<TrackedDeposit[]> {
    return Array.from(this.tracked.values()).filter(
      (deposit) =>
        deposit.userAddress === userAddress &&
        (deposit.status === "matured" || deposit.status === "syncing"),
    );
  }

  async saveBalanceSnapshot(snapshot: BalanceSnapshot): Promise<void> {
    this.snapshots.push(snapshot);
  }

  async getUserDepositAddress(userAddress: string): Promise<{
    userAddress: string;
    depositAddress: string;
    updatedAtMs: number;
  } | null> {
    const record = this.userDepositAddresses.get(userAddress);
    if (!record) {
      return null;
    }

    return {
      userAddress,
      depositAddress: record.depositAddress,
      updatedAtMs: record.updatedAtMs,
    };
  }

  async saveUserDepositAddress(record: {
    userAddress: string;
    depositAddress: string;
    updatedAtMs: number;
  }): Promise<void> {
    this.userDepositAddresses.set(record.userAddress, {
      depositAddress: record.depositAddress,
      updatedAtMs: record.updatedAtMs,
    });
  }

  async getDepositSyncCursor(): Promise<{
    lastProcessedBlockHeight: number;
    updatedAtMs: number;
  } | null> {
    return this.cursor;
  }

  async saveDepositSyncCursor(cursor: {
    lastProcessedBlockHeight: number;
    updatedAtMs: number;
  }): Promise<void> {
    this.cursor = cursor;
  }

  getAllTracked(): TrackedDeposit[] {
    return Array.from(this.tracked.values());
  }

  getAllSnapshots(): BalanceSnapshot[] {
    return this.snapshots;
  }
}

describe("syncDepositsFromCanister", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn());
    process.env.MEMPOOL_API_URL = "https://mempool.space/testnet/api";
  });

  test("should detect matured deposits and sync after 4 confirmations", async () => {
    // given
    const repository = new InMemoryDepositSyncRepository();
    const actor = {
      list_users: vi.fn().mockResolvedValue([{ address: USER_ADDRESS }]),
      get_deposit_address: vi.fn().mockResolvedValue({ Ok: { btc_address: DEPOSIT_ADDRESS } }),
      get_user_balance: vi
        .fn()
        .mockResolvedValueOnce({ Ok: { available: BigInt(0) } })
        .mockResolvedValueOnce({ Ok: { available: BigInt(7000) } }),
      update_ckbtc_balance: vi.fn().mockResolvedValue({ Ok: [] }),
    };
    getCanisterActorMock.mockResolvedValue(actor);
    getDepositSyncRepositoryMock.mockReturnValue(repository);
    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: true,
        text: async () => "200",
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [
          {
            txid: "tx1",
            status: { confirmed: true, block_height: 197 },
            vout: [{ scriptpubkey_address: DEPOSIT_ADDRESS, value: 7000 }],
          },
        ],
      } as Response);

    // when
    const nowSpy = vi.spyOn(Date, "now").mockReturnValue(1_700_000_000_000);
    const result = await syncDepositsFromCanister();
    nowSpy.mockRestore();

    // then
    expect(result.maturedDetected).toBe(1);
    expect(result.syncCalls).toBe(1);
    expect(result.creditedDeposits).toBe(1);
    expect(actor.update_ckbtc_balance).toHaveBeenCalledWith(USER_ADDRESS);
  });

  test("should skip sync work when current tip height was already processed", async () => {
    // given
    const repository = new InMemoryDepositSyncRepository();
    await repository.saveDepositSyncCursor({
      lastProcessedBlockHeight: 500,
      updatedAtMs: 1_700_000_000_000,
    });
    const actor = {
      list_users: vi.fn(),
      get_deposit_address: vi.fn(),
      get_user_balance: vi.fn(),
      update_ckbtc_balance: vi.fn(),
    };
    getCanisterActorMock.mockResolvedValue(actor);
    getDepositSyncRepositoryMock.mockReturnValue(repository);
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      text: async () => "500",
    } as Response);

    // when
    const result = await syncDepositsFromCanister();

    // then
    expect(result).toEqual({
      usersScanned: 0,
      maturedDetected: 0,
      syncCalls: 0,
      creditedDeposits: 0,
      snapshotsSaved: 0,
    });
    expect(actor.list_users).not.toHaveBeenCalled();
    expect(actor.update_ckbtc_balance).not.toHaveBeenCalled();
  });

  test("should credit three matured deposits detected at the same time", async () => {
    // given
    const repository = new InMemoryDepositSyncRepository();
    const FIRST_DEPOSIT_SATS = 7_000;
    const SECOND_DEPOSIT_SATS = 8_000;
    const THIRD_DEPOSIT_SATS = 9_000;
    const TOTAL_CREDITED_SATS = FIRST_DEPOSIT_SATS + SECOND_DEPOSIT_SATS + THIRD_DEPOSIT_SATS;

    const actor = {
      list_users: vi.fn().mockResolvedValue([{ address: USER_ADDRESS }]),
      get_deposit_address: vi.fn().mockResolvedValue({ Ok: { btc_address: DEPOSIT_ADDRESS } }),
      get_user_balance: vi
        .fn()
        .mockResolvedValueOnce({ Ok: { available: BigInt(0) } })
        .mockResolvedValueOnce({ Ok: { available: BigInt(TOTAL_CREDITED_SATS) } }),
      update_ckbtc_balance: vi.fn().mockResolvedValue({ Ok: [] }),
    };
    getCanisterActorMock.mockResolvedValue(actor);
    getDepositSyncRepositoryMock.mockReturnValue(repository);
    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: true,
        text: async () => "500",
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [
          {
            txid: "tx-a",
            status: { confirmed: true, block_height: 497 },
            vout: [{ scriptpubkey_address: DEPOSIT_ADDRESS, value: FIRST_DEPOSIT_SATS }],
          },
          {
            txid: "tx-b",
            status: { confirmed: true, block_height: 497 },
            vout: [{ scriptpubkey_address: DEPOSIT_ADDRESS, value: SECOND_DEPOSIT_SATS }],
          },
          {
            txid: "tx-c",
            status: { confirmed: true, block_height: 497 },
            vout: [{ scriptpubkey_address: DEPOSIT_ADDRESS, value: THIRD_DEPOSIT_SATS }],
          },
        ],
      } as Response);

    // when
    const nowSpy = vi.spyOn(Date, "now").mockReturnValue(1_700_000_000_000);
    const result = await syncDepositsFromCanister();
    nowSpy.mockRestore();

    // then
    expect(result.maturedDetected).toBe(3);
    expect(result.syncCalls).toBe(1);
    expect(result.creditedDeposits).toBe(3);
    expect(actor.update_ckbtc_balance).toHaveBeenCalledTimes(1);

    const trackedDeposits = repository.getAllTracked();
    expect(trackedDeposits).toHaveLength(3);
    expect(trackedDeposits.every((deposit) => deposit.status === "credited")).toBe(true);

    const snapshots = repository.getAllSnapshots();
    expect(snapshots).toHaveLength(1);
    expect(snapshots[0]?.deltaSats).toBe(TOTAL_CREDITED_SATS.toString());
    expect(snapshots[0]?.linkedTxRefs).toHaveLength(3);
  });

  test("should credit only two deposits when minter credits a partial balance delta", async () => {
    // given
    const repository = new InMemoryDepositSyncRepository();
    const FIRST_DEPOSIT_SATS = 7_000;
    const SECOND_DEPOSIT_SATS = 8_000;
    const THIRD_DEPOSIT_SATS = 9_000;
    const PARTIAL_CREDITED_SATS = FIRST_DEPOSIT_SATS + SECOND_DEPOSIT_SATS;
    const nowValue = 1_700_000_000_000;

    const actor = {
      list_users: vi.fn().mockResolvedValue([{ address: USER_ADDRESS }]),
      get_deposit_address: vi.fn().mockResolvedValue({ Ok: { btc_address: DEPOSIT_ADDRESS } }),
      get_user_balance: vi
        .fn()
        .mockResolvedValueOnce({ Ok: { available: BigInt(0) } })
        .mockResolvedValueOnce({ Ok: { available: BigInt(PARTIAL_CREDITED_SATS) } }),
      update_ckbtc_balance: vi.fn().mockResolvedValue({ Ok: [] }),
    };
    getCanisterActorMock.mockResolvedValue(actor);
    getDepositSyncRepositoryMock.mockReturnValue(repository);
    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: true,
        text: async () => "500",
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [
          {
            txid: "tx-partial-a",
            status: { confirmed: true, block_height: 497 },
            vout: [{ scriptpubkey_address: DEPOSIT_ADDRESS, value: FIRST_DEPOSIT_SATS }],
          },
          {
            txid: "tx-partial-b",
            status: { confirmed: true, block_height: 497 },
            vout: [{ scriptpubkey_address: DEPOSIT_ADDRESS, value: SECOND_DEPOSIT_SATS }],
          },
          {
            txid: "tx-partial-c",
            status: { confirmed: true, block_height: 497 },
            vout: [{ scriptpubkey_address: DEPOSIT_ADDRESS, value: THIRD_DEPOSIT_SATS }],
          },
        ],
      } as Response);

    // when
    const nowSpy = vi.spyOn(Date, "now").mockReturnValue(nowValue);
    const result = await syncDepositsFromCanister();
    nowSpy.mockRestore();

    // then
    expect(result.maturedDetected).toBe(3);
    expect(result.syncCalls).toBe(1);
    expect(result.creditedDeposits).toBe(2);
    expect(actor.update_ckbtc_balance).toHaveBeenCalledTimes(1);

    const trackedDeposits = repository.getAllTracked();
    expect(trackedDeposits).toHaveLength(3);

    const creditedDeposits = trackedDeposits.filter((deposit) => deposit.status === "credited");
    const pendingDeposits = trackedDeposits.filter((deposit) => deposit.status === "matured");
    expect(creditedDeposits).toHaveLength(2);
    expect(pendingDeposits).toHaveLength(1);
    expect(creditedDeposits.reduce((sum, deposit) => sum + deposit.valueSats, 0)).toBe(
      PARTIAL_CREDITED_SATS,
    );
    expect(pendingDeposits[0]?.syncAttemptCount).toBe(1);
    expect(pendingDeposits[0]?.nextSyncAtMs).toBe(nowValue + 60_000);

    const snapshots = repository.getAllSnapshots();
    expect(snapshots).toHaveLength(1);
    expect(snapshots[0]?.deltaSats).toBe(PARTIAL_CREDITED_SATS.toString());
    expect(snapshots[0]?.linkedTxRefs).toHaveLength(2);
  });

  test("should not sync before four confirmations", async () => {
    // given
    const repository = new InMemoryDepositSyncRepository();
    const actor = {
      list_users: vi.fn().mockResolvedValue([{ address: USER_ADDRESS }]),
      get_deposit_address: vi.fn().mockResolvedValue({ Ok: { btc_address: DEPOSIT_ADDRESS } }),
      get_user_balance: vi.fn(),
      update_ckbtc_balance: vi.fn(),
    };
    getCanisterActorMock.mockResolvedValue(actor);
    getDepositSyncRepositoryMock.mockReturnValue(repository);
    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: true,
        text: async () => "200",
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [
          {
            txid: "tx2",
            status: { confirmed: true, block_height: 198 },
            vout: [{ scriptpubkey_address: DEPOSIT_ADDRESS, value: 9000 }],
          },
        ],
      } as Response);

    // when
    const nowSpy = vi.spyOn(Date, "now").mockReturnValue(1_700_000_000_000);
    const result = await syncDepositsFromCanister();
    nowSpy.mockRestore();

    // then
    expect(result.maturedDetected).toBe(0);
    expect(result.syncCalls).toBe(0);
    expect(actor.update_ckbtc_balance).not.toHaveBeenCalled();
  });

  test("should use exponential backoff and keep snapshot history when sync does not credit", async () => {
    // given
    const repository = new InMemoryDepositSyncRepository();
    const actor = {
      list_users: vi.fn().mockResolvedValue([{ address: USER_ADDRESS }]),
      get_deposit_address: vi.fn().mockResolvedValue({ Ok: { btc_address: DEPOSIT_ADDRESS } }),
      get_user_balance: vi
        .fn()
        .mockResolvedValueOnce({ Ok: { available: BigInt(1000) } })
        .mockResolvedValueOnce({ Ok: { available: BigInt(1000) } }),
      update_ckbtc_balance: vi.fn().mockResolvedValue({ Ok: [] }),
    };
    getCanisterActorMock.mockResolvedValue(actor);
    getDepositSyncRepositoryMock.mockReturnValue(repository);
    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: true,
        text: async () => "400",
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [
          {
            txid: "tx3",
            status: { confirmed: true, block_height: 390 },
            vout: [{ scriptpubkey_address: DEPOSIT_ADDRESS, value: 7000 }],
          },
        ],
      } as Response);
    const nowValue = 1_700_000_000_000;

    // when
    const nowSpy = vi.spyOn(Date, "now").mockReturnValue(nowValue);
    await syncDepositsFromCanister();
    nowSpy.mockRestore();

    // then
    const tracked = repository.getAllTracked();
    expect(tracked).toHaveLength(1);
    expect(tracked[0]?.syncAttemptCount).toBe(1);
    expect(tracked[0]?.nextSyncAtMs).toBe(nowValue + 60_000);
    expect(repository.getAllSnapshots()).toHaveLength(1);
  });
});
