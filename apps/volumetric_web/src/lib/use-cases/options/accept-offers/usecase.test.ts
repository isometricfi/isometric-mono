import { beforeEach, describe, expect, test, vi } from "vitest";
import { acceptOffers } from "./usecase";

const { getCanisterActorMock } = vi.hoisted(() => ({
  getCanisterActorMock: vi.fn(),
}));

vi.mock("@/lib/canister-server", () => ({
  getCanisterActor: getCanisterActorMock,
}));

vi.mock("../../feature-flags/_shared/assert-not-paused", () => ({
  assertNotPaused: vi.fn().mockResolvedValue(undefined),
}));

describe("acceptOffers usecase", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("should return mapped output after succeeded status", async () => {
    // given
    const operationId = [1, 2, 3];
    const actor = {
      accept_offers: vi.fn().mockResolvedValue({
        Ok: {
          operation_id: operationId,
          accept_journal_entry_id: BigInt(1),
          fill_group_id: BigInt(7),
        },
      }),
      get_accept_status: vi
        .fn()
        .mockResolvedValueOnce({
          Ok: {
            Pending: {
              receipt: {
                operation_id: operationId,
                accept_journal_entry_id: BigInt(1),
                fill_group_id: BigInt(7),
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
                accept_journal_entry_id: BigInt(1),
                fill_group_id: BigInt(7),
              },
              result: {
                fill_group_id: BigInt(7),
                active_options: [{ id: BigInt(99) }],
              },
            },
          },
        }),
    };
    getCanisterActorMock.mockResolvedValue(actor);

    // when
    const result = await acceptOffers({
      address: "tb1qbuyer",
      signature: "signature",
      expiresAtSeconds: "1700000000",
      items: [{ offerId: "1", quantity: "1000" }],
    });

    // then
    expect(result).toEqual({
      fillGroupId: "7",
      activeOptionIds: ["99"],
    });
    expect(actor.get_accept_status).toHaveBeenCalledTimes(2);
  });

  test("should throw failed terminal message", async () => {
    // given
    const operationId = [5, 6, 7];
    const actor = {
      accept_offers: vi.fn().mockResolvedValue({
        Ok: {
          operation_id: operationId,
          accept_journal_entry_id: BigInt(1),
          fill_group_id: BigInt(7),
        },
      }),
      get_accept_status: vi.fn().mockResolvedValue({
        Ok: {
          Failed: {
            receipt: {
              operation_id: operationId,
              accept_journal_entry_id: BigInt(1),
              fill_group_id: BigInt(7),
            },
            message: "accept failed",
          },
        },
      }),
    };
    getCanisterActorMock.mockResolvedValue(actor);

    // when
    const run = acceptOffers({
      address: "tb1qbuyer",
      signature: "signature",
      expiresAtSeconds: "1700000000",
      items: [{ offerId: "1", quantity: "1000" }],
    });

    // then
    await expect(run).rejects.toThrow("accept failed");
  });

  test("should throw timeout when status stays pending", async () => {
    // given
    vi.useFakeTimers();
    const operationId = [8, 9, 10];
    const actor = {
      accept_offers: vi.fn().mockResolvedValue({
        Ok: {
          operation_id: operationId,
          accept_journal_entry_id: BigInt(1),
          fill_group_id: BigInt(7),
        },
      }),
      get_accept_status: vi.fn().mockResolvedValue({
        Ok: {
          Pending: {
            receipt: {
              operation_id: operationId,
              accept_journal_entry_id: BigInt(1),
              fill_group_id: BigInt(7),
            },
            phase: { Started: null },
            last_error: [],
          },
        },
      }),
    };
    getCanisterActorMock.mockResolvedValue(actor);

    // when
    const run = acceptOffers({
      address: "tb1qbuyer",
      signature: "signature",
      expiresAtSeconds: "1700000000",
      items: [{ offerId: "1", quantity: "1000" }],
    });
    const timeoutExpectation = expect(run).rejects.toThrow("terminal state");
    await vi.runAllTimersAsync();

    // then
    await timeoutExpectation;
    vi.useRealTimers();
  });
});
