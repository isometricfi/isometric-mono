import { beforeEach, describe, expect, test, vi } from "vitest";
import { withdraw } from "./usecase";

const { getCanisterActorMock, saveTrackedWithdrawalMock } = vi.hoisted(() => ({
  getCanisterActorMock: vi.fn(),
  saveTrackedWithdrawalMock: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/canister-server", () => ({
  getCanisterActor: getCanisterActorMock,
}));

vi.mock("@/lib/repositories/withdrawal-sync/get-withdrawal-sync-repository", () => ({
  getWithdrawalSyncRepository: () => ({
    saveTrackedWithdrawal: saveTrackedWithdrawalMock,
  }),
}));

vi.mock("../../feature-flags/_shared/assert-not-paused", () => ({
  assertNotPaused: vi.fn().mockResolvedValue(undefined),
}));

describe("withdraw usecase", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("should return block index after succeeded status", async () => {
    // given
    const operationId = [1, 2, 3];
    const actor = {
      withdraw_ckbtc: vi.fn().mockResolvedValue({
        Ok: {
          operation_id: operationId,
          withdrawal_id: BigInt(2),
        },
      }),
      get_withdraw_status: vi
        .fn()
        .mockResolvedValueOnce({
          Ok: {
            Pending: {
              receipt: {
                operation_id: operationId,
                withdrawal_id: BigInt(2),
              },
              phase: { Started: null },
              last_error: [],
            },
          },
        })
        .mockResolvedValueOnce({
          Ok: {
            Succeeded: {
              receipt: {
                operation_id: operationId,
                withdrawal_id: BigInt(2),
              },
              result: { block_index: BigInt(777) },
            },
          },
        }),
    };
    getCanisterActorMock.mockResolvedValue(actor);

    // when
    const result = await withdraw({
      address: "tb1quser",
      signature: "signature",
      expiresAtSeconds: "1700000000",
      amount: "1000",
    });

    // then
    expect(result).toEqual({ blockIndex: BigInt(777) });
    expect(actor.get_withdraw_status).toHaveBeenCalledTimes(2);
    expect(saveTrackedWithdrawalMock).toHaveBeenCalled();
    const initialCall = saveTrackedWithdrawalMock.mock.calls[0]?.[0];
    expect(initialCall).toMatchObject({
      operationId: "010203",
      userAddress: "tb1quser",
      withdrawalId: 2,
      destinationAddress: "tb1quser",
      amountSats: 1000,
      status: "broadcasting",
      phase: "started",
    });
  });

  test("should throw failed terminal message", async () => {
    // given
    const operationId = [5, 6, 7];
    const actor = {
      withdraw_ckbtc: vi.fn().mockResolvedValue({
        Ok: {
          operation_id: operationId,
          withdrawal_id: BigInt(2),
        },
      }),
      get_withdraw_status: vi.fn().mockResolvedValue({
        Ok: {
          Failed: {
            receipt: {
              operation_id: operationId,
              withdrawal_id: BigInt(2),
            },
            message: "withdraw failed",
          },
        },
      }),
    };
    getCanisterActorMock.mockResolvedValue(actor);

    // when
    const run = withdraw({
      address: "tb1quser",
      signature: "signature",
      expiresAtSeconds: "1700000000",
      amount: "1000",
    });

    // then
    await expect(run).rejects.toThrow("withdraw failed");
  });

  test("should throw timeout when status stays pending", async () => {
    // given
    vi.useFakeTimers();
    const operationId = [8, 9, 10];
    const actor = {
      withdraw_ckbtc: vi.fn().mockResolvedValue({
        Ok: {
          operation_id: operationId,
          withdrawal_id: BigInt(2),
        },
      }),
      get_withdraw_status: vi.fn().mockResolvedValue({
        Ok: {
          Pending: {
            receipt: {
              operation_id: operationId,
              withdrawal_id: BigInt(2),
            },
            phase: { Started: null },
            last_error: [],
          },
        },
      }),
    };
    getCanisterActorMock.mockResolvedValue(actor);

    // when
    const run = withdraw({
      address: "tb1quser",
      signature: "signature",
      expiresAtSeconds: "1700000000",
      amount: "1000",
    });
    const timeoutExpectation = expect(run).rejects.toThrow("terminal state");
    await vi.runAllTimersAsync();

    // then
    await timeoutExpectation;
    vi.useRealTimers();
  });
});
