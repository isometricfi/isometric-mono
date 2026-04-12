import { describe, expect, test } from "vitest";
import type { OptionOffer } from "@/types/options";
import {
  findBestOfferForPremiumAmount,
  getMinPremiumAmountSats,
  isBalanceInsufficientForPremiumPurchase,
} from "./premium-amount";

const TEST_OFFER: OptionOffer = {
  id: "offer-1",
  writerId: "writer-1",
  amountSats: 40_000,
  premium: 1,
  strikePercent: 5,
  termDays: 1,
  createdAt: "2026-04-10T00:00:00.000Z",
  expiresAt: "2026-04-11T00:00:00.000Z",
};

describe("isBalanceInsufficientForPremiumPurchase", () => {
  test("should not require collateral-sized balance when premium minimum is covered", () => {
    // given
    const minAcceptOfferAmountSats = 10_000;
    const EXPECTED_MIN_PREMIUM_SATS = 100;
    const availableBalanceSats = 500;
    const offers = [TEST_OFFER];
    const minPremiumAmountSats = getMinPremiumAmountSats(offers, minAcceptOfferAmountSats);

    // when
    const isInsufficient = isBalanceInsufficientForPremiumPurchase(
      availableBalanceSats,
      minPremiumAmountSats,
    );

    // then
    expect(minPremiumAmountSats).toBe(EXPECTED_MIN_PREMIUM_SATS);
    expect(isInsufficient).toBe(false);
  });
});

describe("findBestOfferForPremiumAmount", () => {
  test("should allow quantity below create-offer minimum when premium can cover it", () => {
    // given
    const premiumAmountSats = 300;
    const minAcceptOfferAmountSats = 10_000;
    const maxAcceptOfferAmountSats = 35_000;
    const offers = [TEST_OFFER];

    // when
    const bestMatch = findBestOfferForPremiumAmount(
      offers,
      premiumAmountSats,
      minAcceptOfferAmountSats,
      maxAcceptOfferAmountSats,
    );

    // then
    expect(bestMatch).not.toBeNull();
    expect(bestMatch?.quantitySats).toBe(30_000);
  });
});
