import { Principal } from "@icp-sdk/core/principal";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { getHistoryByHash } from "./usecase";

const { getCanisterActorMock, getHistoryMock } = vi.hoisted(() => ({
  getCanisterActorMock: vi.fn(),
  getHistoryMock: vi.fn(),
}));

vi.mock("@/lib/canister-server", () => ({
  getCanisterActor: getCanisterActorMock,
}));

vi.mock("../get-history/usecase", () => ({
  getHistory: getHistoryMock,
}));

describe("getHistoryByHash", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("should resolve invite codes before loading history", async () => {
    // given
    const principal = Principal.fromText("aaaaa-aa");
    const resolvedAddress = "bc1qresolvedaddress";
    const actor = {
      resolve_invite_code: vi.fn().mockResolvedValue([resolvedAddress]),
      get_account_info: vi.fn().mockResolvedValue({
        Ok: [
          {
            principal,
            username: ["alice"],
            subaccount: new Uint8Array([0, 1, 2, 3]),
            address: resolvedAddress,
            invite_code: ["ABC123"],
            referral_count: [],
          },
        ],
      }),
    };
    const historyEntries = [
      {
        id: "1",
        role: "buyer" as const,
        optionType: "call" as const,
        quantitySats: BigInt(100),
        strikePriceCents: BigInt(100_000),
        entryPriceCents: BigInt(100_000),
        settlementPriceCents: BigInt(110_000),
        premiumSats: BigInt(10),
        payoutSats: BigInt(20),
        pnlSats: BigInt(10),
        pnlPercent: 10,
        result: "profit" as const,
        moneyStatus: "itm" as const,
        acceptedAt: BigInt(1),
        settledAt: BigInt(2),
      },
    ];
    getCanisterActorMock.mockResolvedValue(actor);
    getHistoryMock.mockResolvedValue({ entries: historyEntries });

    // when
    const result = await getHistoryByHash("abc123");

    // then
    expect(actor.resolve_invite_code).toHaveBeenCalledWith("ABC123");
    expect(actor.get_account_info).toHaveBeenCalledWith(resolvedAddress, false);
    expect(getHistoryMock).toHaveBeenCalledWith(principal.toString());
    expect(result).toEqual({
      entries: historyEntries,
      username: "alice",
      principal: principal.toString(),
      address: resolvedAddress,
    });
  });

  test("should return an empty response when an invite code cannot be resolved", async () => {
    // given
    const actor = {
      resolve_invite_code: vi.fn().mockResolvedValue([]),
      get_account_info: vi.fn(),
    };
    getCanisterActorMock.mockResolvedValue(actor);

    // when
    const result = await getHistoryByHash("abc123");

    // then
    expect(actor.get_account_info).not.toHaveBeenCalled();
    expect(getHistoryMock).not.toHaveBeenCalled();
    expect(result).toEqual({
      entries: [],
      username: null,
      principal: undefined,
    });
  });
});
