import { beforeEach, describe, expect, test, vi } from "vitest";
import type {
  IWithdrawalSyncRepository,
  TrackedWithdrawal,
} from "@/lib/repositories/withdrawal-sync/withdrawal-sync-repository.interface";
import { reconcileTrackedWithdrawal } from "./reconciliation";

const { resolveBitcoinTxidFromMinterMock, getMempoolTxStatusMock } = vi.hoisted(() => ({
  resolveBitcoinTxidFromMinterMock: vi.fn(),
  getMempoolTxStatusMock: vi.fn(),
}));

vi.mock("./minter-client", () => ({
  resolveBitcoinTxidFromMinter: resolveBitcoinTxidFromMinterMock,
}));

vi.mock("@/lib/mempool-client", () => ({
  getMempoolTxStatus: getMempoolTxStatusMock,
  getMempoolTipHeight: vi.fn().mockResolvedValue(800_000),
}));

function makeRepository(): IWithdrawalSyncRepository {
  return {
    getTrackedWithdrawalByOperationId: vi.fn(),
    saveTrackedWithdrawal: vi.fn().mockResolvedValue(undefined),
    listDueTrackedWithdrawals: vi.fn().mockResolvedValue([]),
    listUserPendingWithdrawals: vi.fn().mockResolvedValue([]),
  };
}

function makeRow(overrides: Partial<TrackedWithdrawal>): TrackedWithdrawal {
  return {
    operationId: "010203",
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

const NOW_MS = 10 * 60 * 1000;
const ONE_HOUR_MS = 60 * 60 * 1000;
const TWENTY_FIVE_HOURS_MS = 25 * 60 * 60 * 1000;

describe("reconcileTrackedWithdrawal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("resolves block index from canister when phase is RetrieveRequested", async () => {
    // given
    const repository = makeRepository();
    const actor = {
      get_withdraw_status: vi.fn().mockResolvedValue({
        Ok: {
          Pending: {
            receipt: { operation_id: [1, 2, 3], withdrawal_id: BigInt(1) },
            phase: { RetrieveRequested: { block_index: BigInt(42) } },
            last_error: [],
          },
        },
      }),
    };

    // when
    const totals = await reconcileTrackedWithdrawal({
      repository,
      // biome-ignore lint/suspicious/noExplicitAny: minimal actor shape for test
      actor: actor as any,
      withdrawal: makeRow({}),
      nowMs: NOW_MS,
      tipHeight: 800_000,
      requiredConfirmations: 1,
      maxAgeMs: ONE_HOUR_MS,
      getBackoffDelayMs: () => 60_000,
    });

    // then
    expect(totals.blockIndexResolved).toBe(1);
    const saved = (repository.saveTrackedWithdrawal as unknown as ReturnType<typeof vi.fn>).mock
      .calls[0]?.[0] as TrackedWithdrawal;
    expect(saved.blockIndex).toBe(42);
    expect(saved.phase).toBe("retrieve_requested");
  });

  test("marks failed when canister returns Failed status", async () => {
    // given
    const repository = makeRepository();
    const actor = {
      get_withdraw_status: vi.fn().mockResolvedValue({
        Ok: {
          Failed: {
            receipt: { operation_id: [1, 2, 3], withdrawal_id: BigInt(1) },
            message: "boom",
          },
        },
      }),
    };

    // when
    const totals = await reconcileTrackedWithdrawal({
      repository,
      // biome-ignore lint/suspicious/noExplicitAny: minimal actor shape for test
      actor: actor as any,
      withdrawal: makeRow({}),
      nowMs: NOW_MS,
      tipHeight: 800_000,
      requiredConfirmations: 1,
      maxAgeMs: ONE_HOUR_MS,
      getBackoffDelayMs: () => 60_000,
    });

    // then
    expect(totals.failed).toBe(1);
    const saved = (repository.saveTrackedWithdrawal as unknown as ReturnType<typeof vi.fn>).mock
      .calls[0]?.[0] as TrackedWithdrawal;
    expect(saved.status).toBe("failed");
    expect(saved.lastError).toBe("boom");
  });

  test("resolves bitcoin txid from minter when block index is known", async () => {
    // given
    const repository = makeRepository();
    resolveBitcoinTxidFromMinterMock.mockResolvedValue({ kind: "txid", txid: "ffaa" });

    // when
    const totals = await reconcileTrackedWithdrawal({
      repository,
      actor: {} as never,
      withdrawal: makeRow({ blockIndex: 42 }),
      nowMs: NOW_MS,
      tipHeight: 800_000,
      requiredConfirmations: 1,
      maxAgeMs: ONE_HOUR_MS,
      getBackoffDelayMs: () => 60_000,
    });

    // then
    expect(totals.txidResolved).toBe(1);
    const saved = (repository.saveTrackedWithdrawal as unknown as ReturnType<typeof vi.fn>).mock
      .calls[0]?.[0] as TrackedWithdrawal;
    expect(saved.bitcoinTxid).toBe("ffaa");
    expect(saved.status).toBe("pending");
  });

  test("marks completed once mempool reports the required confirmations", async () => {
    // given
    const repository = makeRepository();
    getMempoolTxStatusMock.mockResolvedValue({ confirmed: true, block_height: 800_000 });

    // when
    const totals = await reconcileTrackedWithdrawal({
      repository,
      actor: {} as never,
      withdrawal: makeRow({ blockIndex: 42, bitcoinTxid: "ffaa", status: "pending" }),
      nowMs: NOW_MS,
      tipHeight: 800_000,
      requiredConfirmations: 1,
      maxAgeMs: ONE_HOUR_MS,
      getBackoffDelayMs: () => 60_000,
    });

    // then
    expect(totals.completed).toBe(1);
    const saved = (repository.saveTrackedWithdrawal as unknown as ReturnType<typeof vi.fn>).mock
      .calls[0]?.[0] as TrackedWithdrawal;
    expect(saved.status).toBe("completed");
    expect(saved.confirmations).toBe(1);
  });

  test("expires rows older than maxAgeMs", async () => {
    // given
    const repository = makeRepository();

    // when
    const totals = await reconcileTrackedWithdrawal({
      repository,
      actor: {} as never,
      withdrawal: makeRow({ createdAtMs: 0 }),
      nowMs: TWENTY_FIVE_HOURS_MS,
      tipHeight: 800_000,
      requiredConfirmations: 1,
      maxAgeMs: 24 * 60 * 60 * 1000,
      getBackoffDelayMs: () => 60_000,
    });

    // then
    expect(totals.expired).toBe(1);
    const saved = (repository.saveTrackedWithdrawal as unknown as ReturnType<typeof vi.fn>).mock
      .calls[0]?.[0] as TrackedWithdrawal;
    expect(saved.status).toBe("expired");
  });
});
