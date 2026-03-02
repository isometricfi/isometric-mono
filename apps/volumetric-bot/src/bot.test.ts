import { beforeEach, describe, expect, test, vi } from "vitest";
import { BOT_ACTION, createBotRuntime } from "./bot";
import type { BotConfig } from "./config";

const BOT_CONFIG: BotConfig = {
  privateKeyWif: "mock-wif",
  trpcUrl: "https://example.com/api/trpc",
  canisterId: "mock-canister-id",
  icHost: "https://ic0.app",
  btcNetwork: "testnet",
  intervalMs: 60_000,
  botName: "test-bot",
};

const { setupMock, createOfferMock, acceptOfferMock, acceptOfferOutcomeMock } = vi.hoisted(() => ({
  setupMock: vi.fn(),
  createOfferMock: vi.fn(),
  acceptOfferMock: vi.fn(),
  acceptOfferOutcomeMock: {
    accepted: "accepted",
    noOffers: "no_offers",
    onlyOwnOffers: "only_own_offers",
    noShortTermOffers: "no_short_term_offers",
    noValidOffers: "no_valid_offers",
    insufficientBalance: "insufficient_balance",
  },
}));

vi.mock("./actions/setup.js", () => ({
  setup: setupMock,
}));

vi.mock("./actions/create-offer.js", () => ({
  createOffer: createOfferMock,
}));

vi.mock("./actions/accept-offer.js", () => ({
  acceptOffer: acceptOfferMock,
  ACCEPT_OFFER_OUTCOME: acceptOfferOutcomeMock,
}));

vi.mock("./wallet.js", () => ({
  createWallet: vi.fn().mockReturnValue({
    address: "tb1qtest",
    signMessage: vi.fn().mockReturnValue("signature"),
  }),
}));

vi.mock("./canister-client.js", () => ({
  getCanisterActor: vi.fn().mockResolvedValue({}),
}));

vi.mock("./trpc-client.js", () => ({
  getTRPCClient: vi.fn().mockReturnValue({}),
}));

vi.mock("./telemetry.js", () => ({
  log: vi.fn(),
  withSpan: vi.fn().mockImplementation((_name, _attrs, fn) =>
    fn({
      setAttribute: vi.fn(),
      setStatus: vi.fn(),
      recordException: vi.fn(),
      end: vi.fn(),
    }),
  ),
}));

describe("createBotRuntime", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupMock.mockResolvedValue(undefined);
    createOfferMock.mockResolvedValue(undefined);
  });

  test("should run accept-first and fallback to create when no candidate is available", async () => {
    // given
    acceptOfferMock.mockResolvedValue({ outcome: acceptOfferOutcomeMock.noValidOffers });
    const runtime = await createBotRuntime(BOT_CONFIG);

    // when
    const performedAction = await runtime.runRandomAction();

    // then
    expect(acceptOfferMock).toHaveBeenCalledTimes(1);
    expect(createOfferMock).toHaveBeenCalledTimes(1);
    expect(performedAction).toBe(BOT_ACTION.create);
  });

  test("should not create when accept succeeds", async () => {
    // given
    acceptOfferMock.mockResolvedValue({ outcome: acceptOfferOutcomeMock.accepted });
    const runtime = await createBotRuntime(BOT_CONFIG);

    // when
    const performedAction = await runtime.runRandomAction();

    // then
    expect(acceptOfferMock).toHaveBeenCalledTimes(1);
    expect(createOfferMock).not.toHaveBeenCalled();
    expect(performedAction).toBe(BOT_ACTION.accept);
  });
});
