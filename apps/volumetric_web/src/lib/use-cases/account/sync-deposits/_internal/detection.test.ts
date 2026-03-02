import type { _SERVICE } from "@volumetric/canister-types";
import { describe, expect, test, vi } from "vitest";
import type {
  IDepositSyncRepository,
  TrackedDeposit,
} from "@/lib/repositories/deposit-sync/deposit-sync-repository.interface";
import { detectMaturedDepositsForUser, groupDueDepositsByUser } from "./detection";

const { getMempoolAddressTransactionsMock } = vi.hoisted(() => ({
  getMempoolAddressTransactionsMock: vi.fn(),
}));

vi.mock("@/lib/mempool-client", () => ({
  getMempoolAddressTransactions: getMempoolAddressTransactionsMock,
}));

const TEST_USER_ADDRESS = "tb1quser";
const TEST_DEPOSIT_ADDRESS = "tb1qdeposit";
const TEST_NOW_MS = 1_700_000_000_000;
const TEST_BLOCK_TIP_HEIGHT = 200;
const TEST_MIN_DEPOSIT_SATS = 5_000;
const TEST_MINTER_CONFIRMATIONS = 4;

function makeTrackedDeposit(overrides: Partial<TrackedDeposit> = {}): TrackedDeposit {
  return {
    key: "k1",
    userAddress: TEST_USER_ADDRESS,
    depositAddress: TEST_DEPOSIT_ADDRESS,
    txid: "tx1",
    vout: 0,
    valueSats: 7_000,
    firstSeenAtMs: TEST_NOW_MS,
    firstSeenHeight: 180,
    confirmations: 10,
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
    getDepositSyncCursor: vi.fn(),
    saveDepositSyncCursor: vi.fn(),
  };
  return repository;
}

function makeActor(getDepositAddressImpl?: () => Promise<{ Ok: { btc_address: string } }>): {
  get_deposit_address: (address: string) => Promise<{ Ok: { btc_address: string } }>;
} {
  return {
    get_deposit_address: vi.fn(
      getDepositAddressImpl ??
        (() =>
          Promise.resolve({
            Ok: { btc_address: TEST_DEPOSIT_ADDRESS },
          })),
    ),
  };
}

describe("detectMaturedDepositsForUser", () => {
  test("should return zero when deposit address cannot be resolved", async () => {
    // given
    const repository = makeRepositoryMocks();
    const actor = makeActor(() => Promise.reject(new Error("no address")));
    getMempoolAddressTransactionsMock.mockResolvedValue([]);

    // when
    const result = await detectMaturedDepositsForUser({
      repository,
      actor: actor as unknown as _SERVICE,
      userAddress: TEST_USER_ADDRESS,
      nowMs: TEST_NOW_MS,
      currentBlockTipHeight: TEST_BLOCK_TIP_HEIGHT,
      minDepositAmountSats: TEST_MIN_DEPOSIT_SATS,
      minterConfirmations: TEST_MINTER_CONFIRMATIONS,
    });

    // then
    expect(result).toBe(0);
    expect(repository.saveTrackedDeposit).not.toHaveBeenCalled();
  });

  test("should detect and save a matured deposit", async () => {
    // given
    const repository = makeRepositoryMocks();
    const actor = makeActor();
    vi.mocked(repository.getTrackedDepositByKey).mockResolvedValue(null);
    getMempoolAddressTransactionsMock.mockResolvedValue([
      {
        txid: "tx-new",
        status: { confirmed: true, block_height: 197 },
        vout: [{ scriptpubkey_address: TEST_DEPOSIT_ADDRESS, value: 8_000 }],
      },
    ]);

    // when
    const detected = await detectMaturedDepositsForUser({
      repository,
      actor: actor as unknown as _SERVICE,
      userAddress: TEST_USER_ADDRESS,
      nowMs: TEST_NOW_MS,
      currentBlockTipHeight: TEST_BLOCK_TIP_HEIGHT,
      minDepositAmountSats: TEST_MIN_DEPOSIT_SATS,
      minterConfirmations: TEST_MINTER_CONFIRMATIONS,
    });

    // then
    expect(detected).toBe(1);
    expect(repository.saveTrackedDeposit).toHaveBeenCalledTimes(1);
    expect(repository.saveTrackedDeposit).toHaveBeenCalledWith(
      expect.objectContaining({
        key: `${TEST_USER_ADDRESS}:tx-new:0`,
        status: "matured",
        confirmations: 4,
      }),
    );
  });

  test("should revive expired tracked deposit to matured", async () => {
    // given
    const repository = makeRepositoryMocks();
    const actor = makeActor();
    vi.mocked(repository.getTrackedDepositByKey).mockResolvedValue(
      makeTrackedDeposit({ status: "expired", confirmations: 1 }),
    );
    getMempoolAddressTransactionsMock.mockResolvedValue([
      {
        txid: "tx1",
        status: { confirmed: true, block_height: 197 },
        vout: [{ scriptpubkey_address: TEST_DEPOSIT_ADDRESS, value: 7_000 }],
      },
    ]);

    // when
    const detected = await detectMaturedDepositsForUser({
      repository,
      actor: actor as unknown as _SERVICE,
      userAddress: TEST_USER_ADDRESS,
      nowMs: TEST_NOW_MS,
      currentBlockTipHeight: TEST_BLOCK_TIP_HEIGHT,
      minDepositAmountSats: TEST_MIN_DEPOSIT_SATS,
      minterConfirmations: TEST_MINTER_CONFIRMATIONS,
    });

    // then
    expect(detected).toBe(0);
    expect(repository.saveTrackedDeposit).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "matured",
        confirmations: 4,
      }),
    );
  });
});

describe("groupDueDepositsByUser", () => {
  test("should group non-expired deposits and expire old ones", async () => {
    // given
    const repository = makeRepositoryMocks();
    const freshDeposit = makeTrackedDeposit({
      key: "fresh",
      userAddress: "u1",
      firstSeenAtMs: TEST_NOW_MS,
    });
    const oldDeposit = makeTrackedDeposit({
      key: "old",
      userAddress: "u2",
      firstSeenAtMs: TEST_NOW_MS - 10_000,
    });

    vi.mocked(repository.listDueTrackedDeposits).mockResolvedValue([freshDeposit, oldDeposit]);

    // when
    const result = await groupDueDepositsByUser({
      repository,
      nowMs: TEST_NOW_MS,
      maxDueDepositsPerTick: 50,
      maxTrackedDepositAgeMs: 5_000,
    });

    // then
    expect(result.get("u1")).toEqual([freshDeposit]);
    expect(result.has("u2")).toBe(false);
    expect(repository.saveTrackedDeposit).toHaveBeenCalledWith(
      expect.objectContaining({ key: "old", status: "expired" }),
    );
  });
});
