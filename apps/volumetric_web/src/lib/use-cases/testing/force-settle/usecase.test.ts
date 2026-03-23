import { beforeEach, describe, expect, test, vi } from "vitest";
import { forceSettle } from "./usecase";

const { getCanisterActorMock } = vi.hoisted(() => ({
  getCanisterActorMock: vi.fn(),
}));

vi.mock("@/lib/canister-server", () => ({
  getCanisterActor: getCanisterActorMock,
}));

describe("forceSettle usecase", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("should return minimal success output after succeeded status", async () => {
    // given
    const operationId = [1, 2, 3];
    const actor = {
      testing_force_settle: vi.fn().mockResolvedValue({
        Ok: {
          operation_id: operationId,
          option_id: BigInt(10),
        },
      }),
      get_settlement_status: vi
        .fn()
        .mockResolvedValueOnce({
          Ok: {
            Pending: {
              receipt: {
                operation_id: operationId,
                option_id: BigInt(10),
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
                option_id: BigInt(10),
              },
              result: {
                option_id: BigInt(10),
              },
            },
          },
        }),
    };
    getCanisterActorMock.mockResolvedValue(actor);

    // when
    const result = await forceSettle({ optionId: "10" });

    // then
    expect(result).toEqual({
      optionId: "10",
      status: "succeeded",
    });
    expect(actor.get_settlement_status).toHaveBeenCalledTimes(2);
  });

  test("should throw failed terminal message", async () => {
    // given
    const operationId = [4, 5, 6];
    const actor = {
      testing_force_settle: vi.fn().mockResolvedValue({
        Ok: {
          operation_id: operationId,
          option_id: BigInt(20),
        },
      }),
      get_settlement_status: vi.fn().mockResolvedValue({
        Ok: {
          Failed: {
            receipt: {
              operation_id: operationId,
              option_id: BigInt(20),
            },
            message: "settlement failed",
          },
        },
      }),
    };
    getCanisterActorMock.mockResolvedValue(actor);

    // when
    const run = forceSettle({ optionId: "20" });

    // then
    await expect(run).rejects.toThrow("settlement failed");
  });

  test("should throw timeout when status stays pending", async () => {
    // given
    vi.useFakeTimers();
    const operationId = [7, 8, 9];
    const actor = {
      testing_force_settle: vi.fn().mockResolvedValue({
        Ok: {
          operation_id: operationId,
          option_id: BigInt(30),
        },
      }),
      get_settlement_status: vi.fn().mockResolvedValue({
        Ok: {
          Pending: {
            receipt: {
              operation_id: operationId,
              option_id: BigInt(30),
            },
            phase: { Started: null },
            last_error: [],
          },
        },
      }),
    };
    getCanisterActorMock.mockResolvedValue(actor);

    // when
    const run = forceSettle({ optionId: "30" });
    const timeoutExpectation = expect(run).rejects.toThrow("terminal state");
    await vi.runAllTimersAsync();

    // then
    await timeoutExpectation;
    vi.useRealTimers();
  });
});
