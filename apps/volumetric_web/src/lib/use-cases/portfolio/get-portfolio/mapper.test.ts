import { Principal } from "@dfinity/principal";
import type {
  ActiveOption,
  ActiveOptionStatus,
  Offer,
  OfferStatus,
} from "@volumetric/canister-types";
import { describe, expect, test } from "vitest";
import { isActiveOffer, isActiveOption, mapOffer, mapOption } from "./mapper";

const DEFAULT_PRINCIPAL = Principal.fromText("aaaaa-aa");

const DEFAULT_OFFER_ID = BigInt(1);
const DEFAULT_TOTAL_QUANTITY = BigInt(100_000);
const DEFAULT_REMAINING_QUANTITY = BigInt(50_000);
const DEFAULT_STRIKE_BASIS_POINTS = 500;
const DEFAULT_PREMIUM_BASIS_POINTS = 200;
const DEFAULT_OPTION_DURATION_SECONDS = BigInt(86_400);
const DEFAULT_OFFER_VALID_UNTIL = BigInt(1_700_000_000);
const DEFAULT_CREATED_AT = BigInt(1_699_000_000);

const DEFAULT_OPTION_ID = BigInt(10);
const DEFAULT_OPTION_QUANTITY = BigInt(25_000);
const DEFAULT_ENTRY_PRICE_CENTS = BigInt(6_500_000);
const DEFAULT_STRIKE_PRICE_CENTS = BigInt(7_000_000);
const DEFAULT_PREMIUM_PAID = BigInt(5_000);
const DEFAULT_EXPIRY = BigInt(1_700_100_000);
const DEFAULT_ACCEPTED_AT = BigInt(1_699_500_000);
const DEFAULT_OPTION_OFFER_ID = BigInt(1);
const DEFAULT_PROFIT_FEE_BASIS_POINTS = BigInt(100);

function makeOffer(overrides: Partial<Offer> = {}): Offer {
  return {
    id: DEFAULT_OFFER_ID,
    status: { Open: null },
    option_type: { Call: null },
    asset: { CkBtc: null },
    total_quantity: DEFAULT_TOTAL_QUANTITY,
    remaining_quantity: DEFAULT_REMAINING_QUANTITY,
    strike_basis_points: DEFAULT_STRIKE_BASIS_POINTS,
    premium_basis_points: DEFAULT_PREMIUM_BASIS_POINTS,
    option_duration_seconds: DEFAULT_OPTION_DURATION_SECONDS,
    offer_valid_until_seconds: DEFAULT_OFFER_VALID_UNTIL,
    created_at_seconds: DEFAULT_CREATED_AT,
    writer: DEFAULT_PRINCIPAL,
    ...overrides,
  };
}

function makeActiveOption(overrides: Partial<ActiveOption> = {}): ActiveOption {
  return {
    id: DEFAULT_OPTION_ID,
    status: { Active: null },
    option_type: { Call: null },
    fill_group_id: [],
    entry_price_cents: DEFAULT_ENTRY_PRICE_CENTS,
    asset: { CkBtc: null },
    accepted_at_seconds: DEFAULT_ACCEPTED_AT,
    writer: DEFAULT_PRINCIPAL,
    offer_id: DEFAULT_OPTION_OFFER_ID,
    profit_fee_basis_points: DEFAULT_PROFIT_FEE_BASIS_POINTS,
    quantity: DEFAULT_OPTION_QUANTITY,
    buyer: DEFAULT_PRINCIPAL,
    expiry_seconds: DEFAULT_EXPIRY,
    premium_paid: DEFAULT_PREMIUM_PAID,
    strike_price_cents: DEFAULT_STRIKE_PRICE_CENTS,
    ...overrides,
  };
}

describe("isActiveOffer", () => {
  const ACTIVE_STATUSES: OfferStatus[] = [
    { Open: null },
    { PartiallyFilled: null },
    { Processing: null },
  ];
  const INACTIVE_STATUSES: OfferStatus[] = [{ Filled: null }, { Cancelled: null }];

  test.each(ACTIVE_STATUSES)("should return true for active status %o", (status) => {
    expect(isActiveOffer(makeOffer({ status }))).toBe(true);
  });

  test.each(INACTIVE_STATUSES)("should return false for inactive status %o", (status) => {
    expect(isActiveOffer(makeOffer({ status }))).toBe(false);
  });
});

describe("isActiveOption", () => {
  const ACTIVE_STATUSES: ActiveOptionStatus[] = [{ Active: null }, { Settling: null }];
  const INACTIVE_STATUSES: ActiveOptionStatus[] = [{ Expired: null }, { Settled: null }];

  test.each(ACTIVE_STATUSES)("should return true for active status %o", (status) => {
    expect(isActiveOption(makeActiveOption({ status }))).toBe(true);
  });

  test.each(INACTIVE_STATUSES)("should return false for inactive status %o", (status) => {
    expect(isActiveOption(makeActiveOption({ status }))).toBe(false);
  });
});

test("should map all offer fields", () => {
  // given
  const offer = makeOffer();

  // when
  const result = mapOffer(offer);

  // then
  expect(result).toEqual({
    id: DEFAULT_OFFER_ID.toString(),
    status: "Open",
    totalQuantity: DEFAULT_TOTAL_QUANTITY,
    remainingQuantity: DEFAULT_REMAINING_QUANTITY,
    strikeBasisPoints: DEFAULT_STRIKE_BASIS_POINTS,
    premiumBasisPoints: DEFAULT_PREMIUM_BASIS_POINTS,
    optionDurationSeconds: DEFAULT_OPTION_DURATION_SECONDS,
    offerValidUntil: DEFAULT_OFFER_VALID_UNTIL,
    createdAt: DEFAULT_CREATED_AT,
  });
});

test("should map all option fields", () => {
  // given
  const option = makeActiveOption();

  // when
  const result = mapOption(option);

  // then
  expect(result).toEqual({
    id: DEFAULT_OPTION_ID.toString(),
    status: "Active",
    quantity: DEFAULT_OPTION_QUANTITY,
    entryPriceCents: DEFAULT_ENTRY_PRICE_CENTS,
    strikePriceCents: DEFAULT_STRIKE_PRICE_CENTS,
    premiumPaid: DEFAULT_PREMIUM_PAID,
    expiry: DEFAULT_EXPIRY,
    acceptedAt: DEFAULT_ACCEPTED_AT,
    offerId: DEFAULT_OPTION_OFFER_ID.toString(),
  });
});
