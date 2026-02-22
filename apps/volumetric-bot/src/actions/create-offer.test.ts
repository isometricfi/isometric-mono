import type { _SERVICE } from "@volumetric/canister-types";
import { beforeEach, describe, expect, test, vi } from "vitest";
import type { TRPCClient } from "../trpc-client";
import type { BotWallet } from "../wallet";
import { createOffer } from "./create-offer";

const BOT_ADDRESS = "mock-address";
const BOT_PRINCIPAL = "mock-principal";
const DEPOSIT_ADDRESS = "tb1qdeposit";
const MIN_OFFER_AMOUNT_SATS = 90_000;
const MAX_OFFER_AMOUNT_SATS = 10_000_000;
const LARGE_AVAILABLE_BALANCE_SATS = BigInt(100_000_000);

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
    address: BOT_ADDRESS,
    signMessage: vi.fn().mockReturnValue("mock-signature"),
  };

  const mockActor = {} as _SERVICE; // cast as we mock the helper function that uses it

  let mockTrpc: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockTrpc = {
      account: {
        getAccount: {
          query: vi.fn(),
        },
        getBalance: {
          query: vi.fn(),
        },
        syncBalance: {
          mutate: vi.fn(),
        },
        getDepositAddress: {
          query: vi.fn(),
        },
      },
      options: {
        listOptions: {
          query: vi.fn(),
        },
        createOffer: {
          mutate: vi.fn(),
        },
      },
      config: {
        getConfig: {
          query: vi.fn(),
        },
      },
    };

    mockTrpc.options.listOptions.query.mockResolvedValue({ termGroups: [] });
    mockTrpc.account.getAccount.query.mockResolvedValue({
      profile: {
        principal: BOT_PRINCIPAL,
      },
    });
    mockTrpc.config.getConfig.query.mockResolvedValue({
      termOptions: [7, 14],
      strikePercentOptions: [5, 10, 15],
      premium: { min: 1, max: 10, step: 0.25 },
      minOfferAmountSats: MIN_OFFER_AMOUNT_SATS,
      maxOfferAmountSats: MAX_OFFER_AMOUNT_SATS,
    });
  });

  test("should skip offer creation if balance is insufficient", async () => {
    // given
    // Setup balance to be 0
    const zeroBalance = BigInt(0);
    mockTrpc.account.getBalance.query
      .mockResolvedValueOnce({ available: zeroBalance })
      .mockResolvedValueOnce({ available: zeroBalance });
    mockTrpc.account.syncBalance.mutate.mockResolvedValue({ success: true });
    mockTrpc.account.getDepositAddress.query.mockResolvedValue({ btcAddress: DEPOSIT_ADDRESS });

    // when
    await createOffer(mockActor, mockTrpc as TRPCClient, mockWallet);

    // then
    expect(mockTrpc.account.getBalance.query).toHaveBeenCalledWith({ address: BOT_ADDRESS });
    expect(mockTrpc.account.syncBalance.mutate).toHaveBeenCalledWith({ address: BOT_ADDRESS });
    expect(mockTrpc.account.getDepositAddress.query).toHaveBeenCalledWith({
      address: BOT_ADDRESS,
    });
    expect(mockTrpc.options.createOffer.mutate).not.toHaveBeenCalled();
  });

  test("should skip offer creation when open offer cap is reached", async () => {
    // given
    mockTrpc.options.listOptions.query.mockResolvedValue({
      termGroups: [
        {
          strikes: [
            {
              offers: [
                { writerId: BOT_ADDRESS, premium: 2, strikePercent: 10, termDays: 7 },
                { writerId: BOT_PRINCIPAL, premium: 2.5, strikePercent: 10, termDays: 7 },
                { writerId: BOT_PRINCIPAL, premium: 3, strikePercent: 10, termDays: 7 },
                { writerId: BOT_PRINCIPAL, premium: 3.5, strikePercent: 10, termDays: 7 },
              ],
            },
          ],
        },
      ],
    });

    // when
    await createOffer(mockActor, mockTrpc as TRPCClient, mockWallet);

    // then
    expect(mockTrpc.account.getBalance.query).not.toHaveBeenCalled();
    expect(mockTrpc.options.createOffer.mutate).not.toHaveBeenCalled();
  });

  test("should create offer if balance is sufficient", async () => {
    // given
    // Setup balance to be large enough (e.g. 1 BTC)
    mockTrpc.account.getBalance.query.mockResolvedValue({
      available: LARGE_AVAILABLE_BALANCE_SATS,
    });
    mockTrpc.account.syncBalance.mutate.mockResolvedValue({ success: true });
    mockTrpc.account.getDepositAddress.query.mockResolvedValue({ btcAddress: DEPOSIT_ADDRESS });

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
    expect(callArgs.address).toBe(BOT_ADDRESS);
    expect(callArgs.signature).toBe("mock-signature");
    expect(callArgs.quantity).toBeDefined();
  });
});
