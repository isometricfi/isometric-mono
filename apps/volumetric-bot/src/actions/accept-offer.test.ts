import type { _SERVICE } from "@volumetric/canister-types";
import { beforeEach, describe, expect, test, vi } from "vitest";
import type { TRPCClient } from "../trpc-client";
import type { BotWallet } from "../wallet";
import { acceptOffer } from "./accept-offer";

const BOT_ADDRESS = "mock-address";
const BOT_PRINCIPAL = "mock-principal";
const OTHER_PRINCIPAL = "other-principal";
const MIN_OFFER_AMOUNT_SATS = 90_000;
const LARGE_AVAILABLE_BALANCE_SATS = BigInt(100_000_000);
const VALID_OFFER_ID = "42";
const VALID_QUANTITY_SATS = 150_000;
const INVALID_QUANTITY_SATS = 80_000;
const STRIKE_PERCENT = 10;
const PREMIUM_PERCENT = 1.25;

vi.mock("../canister-client.js", () => ({
  getAcceptOffersMessage: vi.fn().mockResolvedValue("mock-accept-message"),
}));

vi.mock("../telemetry.js", () => ({
  log: vi.fn(),
  withSpan: vi.fn().mockImplementation((_name, _attrs, fn) => {
    return fn({
      setAttribute: vi.fn(),
      setStatus: vi.fn(),
      recordException: vi.fn(),
      end: vi.fn(),
    });
  }),
}));

describe("acceptOffer", () => {
  const mockWallet: BotWallet = {
    address: BOT_ADDRESS,
    signMessage: vi.fn().mockReturnValue("mock-signature"),
  };

  const mockActor = {} as _SERVICE;

  let mockTrpc: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockTrpc = {
      options: {
        listOptions: {
          query: vi.fn(),
        },
        acceptOffers: {
          mutate: vi.fn(),
        },
      },
      config: {
        getConfig: {
          query: vi.fn().mockResolvedValue({
            minOfferAmountSats: MIN_OFFER_AMOUNT_SATS,
          }),
        },
      },
      account: {
        getAccount: {
          query: vi.fn().mockResolvedValue({
            profile: {
              principal: BOT_PRINCIPAL,
            },
          }),
        },
        getBalance: {
          query: vi.fn().mockResolvedValue({
            available: LARGE_AVAILABLE_BALANCE_SATS,
          }),
        },
      },
    };
  });

  test("should skip offers owned by the same principal", async () => {
    // given
    mockTrpc.options.listOptions.query.mockResolvedValue({
      termGroups: [
        {
          strikes: [
            {
              offers: [
                {
                  id: "1",
                  writerId: BOT_PRINCIPAL,
                  amountSats: VALID_QUANTITY_SATS,
                  premium: PREMIUM_PERCENT,
                  strikePercent: STRIKE_PERCENT,
                  termDays: 7,
                },
              ],
            },
          ],
        },
      ],
    });

    // when
    await acceptOffer(mockActor, mockTrpc as TRPCClient, mockWallet);

    // then
    expect(mockTrpc.options.acceptOffers.mutate).not.toHaveBeenCalled();
  });

  test("should skip offers below configured minimum quantity", async () => {
    // given
    mockTrpc.options.listOptions.query.mockResolvedValue({
      termGroups: [
        {
          strikes: [
            {
              offers: [
                {
                  id: "1",
                  writerId: OTHER_PRINCIPAL,
                  amountSats: INVALID_QUANTITY_SATS,
                  premium: PREMIUM_PERCENT,
                  strikePercent: STRIKE_PERCENT,
                  termDays: 7,
                },
              ],
            },
          ],
        },
      ],
    });

    // when
    await acceptOffer(mockActor, mockTrpc as TRPCClient, mockWallet);

    // then
    expect(mockTrpc.options.acceptOffers.mutate).not.toHaveBeenCalled();
  });

  test("should accept a valid offer from another writer", async () => {
    // given
    mockTrpc.options.listOptions.query.mockResolvedValue({
      termGroups: [
        {
          strikes: [
            {
              offers: [
                {
                  id: VALID_OFFER_ID,
                  writerId: OTHER_PRINCIPAL,
                  amountSats: VALID_QUANTITY_SATS,
                  premium: PREMIUM_PERCENT,
                  strikePercent: STRIKE_PERCENT,
                  termDays: 7,
                },
              ],
            },
          ],
        },
      ],
    });
    mockTrpc.options.acceptOffers.mutate.mockResolvedValue({
      fillGroupId: "fill-1",
      activeOptionIds: ["100"],
    });

    // when
    await acceptOffer(mockActor, mockTrpc as TRPCClient, mockWallet);

    // then
    expect(mockTrpc.options.acceptOffers.mutate).toHaveBeenCalled();
    const payload = mockTrpc.options.acceptOffers.mutate.mock.calls[0][0];
    expect(payload.address).toBe(BOT_ADDRESS);
    expect(payload.signature).toBe("mock-signature");
    expect(payload.items[0].offerId).toBe(VALID_OFFER_ID);
  });
});
