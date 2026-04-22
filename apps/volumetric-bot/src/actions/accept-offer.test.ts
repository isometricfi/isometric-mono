import type { _SERVICE } from "@volumetric/canister-types";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { TRPCClient } from "../trpc-client";
import type { BotWallet } from "../wallet";
import { acceptOffer } from "./accept-offer";

const BOT_ADDRESS = "mock-address";
const BOT_PRINCIPAL = "mock-principal";
const OTHER_PRINCIPAL = "other-principal";
const MIN_OFFER_AMOUNT_SATS = 90_000;
const VALID_OFFER_ID = "42";
const BEST_OFFER_ID = "101";
const WORSE_OFFER_ID = "102";
const TIE_BREAKER_WINNER_ID = "201";
const VALID_QUANTITY_SATS = 150_000;
const INVALID_QUANTITY_SATS = 80_000;
const STRIKE_PERCENT = 10;
const PREMIUM_PERCENT = 1.25;
const LONG_TERM_DAYS = 7;
const SHORT_TERM_DAYS = 2;
type MockProcedure = {
  query: ReturnType<typeof vi.fn>;
  mutate: ReturnType<typeof vi.fn>;
};

interface MockAcceptOfferTrpc {
  options: {
    listOptions: Pick<MockProcedure, "query">;
    acceptOffers: Pick<MockProcedure, "mutate">;
  };
  config: {
    getConfig: Pick<MockProcedure, "query">;
  };
  account: {
    getAccount: Pick<MockProcedure, "query">;
  };
}

vi.mock("../canister-client.js", () => ({
  getAcceptOffersMessage: vi.fn().mockResolvedValue("mock-accept-message"),
  computeExpiresAtSeconds: vi.fn().mockReturnValue(BigInt(1_700_000_000)),
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

  let mockTrpc: MockAcceptOfferTrpc;

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
            minAcceptOfferAmountSats: MIN_OFFER_AMOUNT_SATS,
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
      },
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
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
    await acceptOffer(mockActor, mockTrpc as unknown as TRPCClient, mockWallet);

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
    await acceptOffer(mockActor, mockTrpc as unknown as TRPCClient, mockWallet);

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
                  termDays: SHORT_TERM_DAYS,
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
    await acceptOffer(mockActor, mockTrpc as unknown as TRPCClient, mockWallet);

    // then
    expect(mockTrpc.options.acceptOffers.mutate).toHaveBeenCalled();
    const payload = mockTrpc.options.acceptOffers.mutate.mock.calls[0][0];
    expect(payload.address).toBe(BOT_ADDRESS);
    expect(payload.signature).toBe("mock-signature");
    expect(payload.items[0].offerId).toBe(VALID_OFFER_ID);
  });

  test("should select the best offer deterministically by score", async () => {
    // given
    vi.spyOn(Math, "random").mockReturnValue(0.9999);
    mockTrpc.options.listOptions.query.mockResolvedValue({
      termGroups: [
        {
          strikes: [
            {
              offers: [
                {
                  id: BEST_OFFER_ID,
                  writerId: OTHER_PRINCIPAL,
                  amountSats: 120_000,
                  premium: 1.5,
                  strikePercent: 12,
                  termDays: SHORT_TERM_DAYS,
                },
                {
                  id: WORSE_OFFER_ID,
                  writerId: OTHER_PRINCIPAL,
                  amountSats: 400_000,
                  premium: 6,
                  strikePercent: 8,
                  termDays: SHORT_TERM_DAYS,
                },
              ],
            },
          ],
        },
      ],
    });
    mockTrpc.options.acceptOffers.mutate.mockResolvedValue({
      fillGroupId: "fill-2",
      activeOptionIds: ["200"],
    });

    // when
    await acceptOffer(mockActor, mockTrpc as unknown as TRPCClient, mockWallet);

    // then
    expect(mockTrpc.options.acceptOffers.mutate).toHaveBeenCalled();
    const payload = mockTrpc.options.acceptOffers.mutate.mock.calls[0][0];
    expect(payload.items[0].offerId).toBe(BEST_OFFER_ID);
  });

  test("should ignore offers with termDays over three", async () => {
    // given
    vi.spyOn(Math, "random").mockReturnValue(0);
    mockTrpc.options.listOptions.query.mockResolvedValue({
      termGroups: [
        {
          strikes: [
            {
              offers: [
                {
                  id: WORSE_OFFER_ID,
                  writerId: OTHER_PRINCIPAL,
                  amountSats: VALID_QUANTITY_SATS,
                  premium: 0.25,
                  strikePercent: 20,
                  termDays: LONG_TERM_DAYS,
                },
                {
                  id: VALID_OFFER_ID,
                  writerId: OTHER_PRINCIPAL,
                  amountSats: VALID_QUANTITY_SATS,
                  premium: PREMIUM_PERCENT,
                  strikePercent: STRIKE_PERCENT,
                  termDays: SHORT_TERM_DAYS,
                },
              ],
            },
          ],
        },
      ],
    });
    mockTrpc.options.acceptOffers.mutate.mockResolvedValue({
      fillGroupId: "fill-3",
      activeOptionIds: ["300"],
    });

    // when
    await acceptOffer(mockActor, mockTrpc as unknown as TRPCClient, mockWallet);

    // then
    const payload = mockTrpc.options.acceptOffers.mutate.mock.calls[0][0];
    expect(payload.items[0].offerId).toBe(VALID_OFFER_ID);
  });

  test("should use stable tie-breakers when scores are equal", async () => {
    // given
    vi.spyOn(Math, "random").mockReturnValue(0);
    mockTrpc.options.listOptions.query.mockResolvedValue({
      termGroups: [
        {
          strikes: [
            {
              offers: [
                {
                  id: "300",
                  writerId: OTHER_PRINCIPAL,
                  amountSats: 200_000,
                  premium: 2,
                  strikePercent: 12,
                  termDays: SHORT_TERM_DAYS,
                },
                {
                  id: TIE_BREAKER_WINNER_ID,
                  writerId: OTHER_PRINCIPAL,
                  amountSats: 220_000,
                  premium: 1.75,
                  strikePercent: 11.75,
                  termDays: SHORT_TERM_DAYS,
                },
              ],
            },
          ],
        },
      ],
    });
    mockTrpc.options.acceptOffers.mutate.mockResolvedValue({
      fillGroupId: "fill-4",
      activeOptionIds: ["400"],
    });

    // when
    await acceptOffer(mockActor, mockTrpc as unknown as TRPCClient, mockWallet);

    // then
    const payload = mockTrpc.options.acceptOffers.mutate.mock.calls[0][0];
    expect(payload.items[0].offerId).toBe(TIE_BREAKER_WINNER_ID);
  });
});
