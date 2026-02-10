import type { _SERVICE } from "@volumetric/canister-types";
import { beforeEach, describe, expect, test, vi } from "vitest";
import type { TRPCClient } from "../trpc-client";
import type { BotWallet } from "../wallet";
import { createOffer } from "./create-offer";

// Mock dependencies
vi.mock("../canister-client.js", () => ({
  getCreateOfferMessage: vi.fn().mockResolvedValue("mock-message-to-sign"),
}));

vi.mock("../telemetry.js", () => ({
  log: vi.fn(),
  withSpan: vi.fn().mockImplementation((_name, _attrs, fn) => {
    // Execute the callback immediately with a mock span
    return fn({
      setAttribute: vi.fn(),
      setStatus: vi.fn(),
      recordException: vi.fn(),
      end: vi.fn(),
    });
  }),
}));

describe("createOffer", () => {
  // given
  const mockWallet: BotWallet = {
    address: "mock-address",
    signMessage: vi.fn().mockReturnValue("mock-signature"),
  };

  const mockActor = {} as _SERVICE; // cast as we mock the helper function that uses it

  let mockTrpc: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockTrpc = {
      account: {
        getBalance: {
          query: vi.fn(),
        },
      },
      options: {
        createOffer: {
          mutate: vi.fn(),
        },
      },
    };
  });

  test("should skip offer creation if balance is insufficient", async () => {
    // given
    // Setup balance to be 0
    mockTrpc.account.getBalance.query.mockResolvedValue({ available: BigInt(0) });

    // when
    await createOffer(mockActor, mockTrpc as TRPCClient, mockWallet);

    // then
    expect(mockTrpc.account.getBalance.query).toHaveBeenCalledWith({ address: "mock-address" });
    expect(mockTrpc.options.createOffer.mutate).not.toHaveBeenCalled();
  });

  test("should create offer if balance is sufficient", async () => {
    // given
    // Setup balance to be large enough (e.g. 1 BTC)
    const largeBalance = BigInt(100_000_000);
    mockTrpc.account.getBalance.query.mockResolvedValue({ available: largeBalance });

    // Mock successful offer creation response
    mockTrpc.options.createOffer.mutate.mockResolvedValue({ offerId: "new-offer-id" });

    // when
    await createOffer(mockActor, mockTrpc as TRPCClient, mockWallet);

    // then
    expect(mockTrpc.account.getBalance.query).toHaveBeenCalled();
    expect(mockTrpc.options.createOffer.mutate).toHaveBeenCalled();

    // Verify arguments to mutate
    // We can't easily check exact values because they are random, but we can check the knowns
    const callArgs = mockTrpc.options.createOffer.mutate.mock.calls[0][0];
    expect(callArgs.address).toBe("mock-address");
    expect(callArgs.signature).toBe("mock-signature");
    expect(callArgs.quantity).toBeDefined();
  });
});
