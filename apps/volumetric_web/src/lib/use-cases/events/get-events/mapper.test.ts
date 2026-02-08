import { Principal } from "@dfinity/principal";
import type {
  Event as CanisterEvent,
  EventData as CanisterEventData,
  EventType as CanisterEventType,
} from "@volumetric/canister-types";
import { describe, expect, test } from "vitest";
import { mapEvent, mapEvents } from "./mapper";

const DEFAULT_PRINCIPAL = Principal.fromText("aaaaa-aa");
const DEFAULT_TIMESTAMP_NS = BigInt(1_700_000_000_000_000_000);

function makeCanisterEvent(
  overrides: { data?: CanisterEventData; event_type?: CanisterEventType } = {},
): CanisterEvent {
  return {
    id: BigInt(1),
    principal: DEFAULT_PRINCIPAL,
    timestamp: DEFAULT_TIMESTAMP_NS,
    event_type: overrides.event_type ?? { AccountCreated: null },
    data: overrides.data ?? { AccountCreated: { wallet_address: "bc1qdefault" } },
  };
}

test("should map event envelope fields (id, eventType, principal, timestamp)", () => {
  // given
  const TIMESTAMP_NS_WITH_REMAINDER = BigInt("1700000000123456789");
  const event: CanisterEvent = {
    ...makeCanisterEvent({ event_type: { Deposit: null } }),
    timestamp: TIMESTAMP_NS_WITH_REMAINDER,
  };

  // when
  const result = mapEvent(event);

  // then
  expect(result.id).toBe("1");
  expect(result.eventType).toBe("Deposit");
  expect(result.principal).toBe(DEFAULT_PRINCIPAL.toText());
  expect(result.timestamp).toBe(1_700_000_000_123);
});

describe("mapEventData", () => {
  test("should map AccountCreated", () => {
    // given
    const event = makeCanisterEvent({
      data: { AccountCreated: { wallet_address: "bc1qexample" } },
    });

    // when
    const result = mapEvent(event);

    // then
    expect(result.data).toEqual({ type: "AccountCreated", walletAddress: "bc1qexample" });
  });

  test("should map UsernameUpdated with old username present", () => {
    // given
    const event = makeCanisterEvent({
      data: { UsernameUpdated: { old_username: ["olduser"], new_username: "newuser" } },
    });

    // when
    const result = mapEvent(event);

    // then
    expect(result.data).toEqual({
      type: "UsernameUpdated",
      oldUsername: "olduser",
      newUsername: "newuser",
    });
  });

  test("should map UsernameUpdated with old username absent", () => {
    // given
    const event = makeCanisterEvent({
      data: { UsernameUpdated: { old_username: [], new_username: "newuser" } },
    });

    // when
    const result = mapEvent(event);

    // then
    expect(result.data).toEqual({
      type: "UsernameUpdated",
      oldUsername: null,
      newUsername: "newuser",
    });
  });

  test("should map Deposit", () => {
    // given
    const event = makeCanisterEvent({
      data: { Deposit: { amount_sats: BigInt(100_000) } },
    });

    // when
    const { data } = mapEvent(event);

    // then
    expect(data).toEqual({ type: "Deposit", amountSats: 100_000 });
  });

  test("should map Withdrawal", () => {
    // given
    const event = makeCanisterEvent({
      data: { Withdrawal: { amount_sats: BigInt(50_000), destination: "bc1qwithdraw" } },
    });

    // when
    const { data } = mapEvent(event);

    // then
    expect(data).toEqual({ type: "Withdrawal", amountSats: 50_000, destination: "bc1qwithdraw" });
  });

  test("should map WithdrawalFailed", () => {
    // given
    const event = makeCanisterEvent({
      data: { WithdrawalFailed: { amount_sats: BigInt(50_000), reason: "insufficient funds" } },
    });

    // when
    const { data } = mapEvent(event);

    // then
    expect(data).toEqual({
      type: "WithdrawalFailed",
      amountSats: 50_000,
      reason: "insufficient funds",
    });
  });

  test("should map OfferCreated", () => {
    // given
    const event = makeCanisterEvent({
      data: {
        OfferCreated: {
          offer_id: BigInt(42),
          quantity_sats: BigInt(200_000),
          strike_basis_points: 10_500,
          premium_basis_points: 250,
          duration_seconds: BigInt(86_400),
          offer_valid_until_ns: BigInt(1_700_000_000_000_000_000),
        },
      },
    });

    // when
    const { data } = mapEvent(event);

    // then
    expect(data).toEqual({
      type: "OfferCreated",
      offerId: "42",
      quantitySats: 200_000,
      strikeBasisPoints: 10_500,
      premiumBasisPoints: 250,
      durationSeconds: 86_400,
      offerValidUntilNs: 1_700_000_000_000_000_000,
    });
  });

  test("should map OfferCancelled", () => {
    // given
    const event = makeCanisterEvent({
      data: { OfferCancelled: { offer_id: BigInt(42), remaining_quantity_sats: BigInt(100_000) } },
    });

    // when
    const { data } = mapEvent(event);

    // then
    expect(data).toEqual({ type: "OfferCancelled", offerId: "42", remainingQuantitySats: 100_000 });
  });

  test("should map OfferAccepted with role mapping", () => {
    // given
    const COUNTERPARTY = Principal.fromText("aaaaa-aa");
    const event = makeCanisterEvent({
      data: {
        OfferAccepted: {
          offer_id: BigInt(10),
          option_id: BigInt(20),
          fill_group_id: BigInt(30),
          counterparty: COUNTERPARTY,
          quantity_sats: BigInt(200_000),
          premium_sats: BigInt(5_000),
          entry_price_cents: BigInt(9_500_000),
          strike_price_cents: BigInt(10_000_000),
          expiry_ns: BigInt(1_700_100_000_000_000_000),
          role: { Buyer: null },
        },
      },
    });

    // when
    const { data } = mapEvent(event);

    // then
    expect(data).toEqual({
      type: "OfferAccepted",
      offerId: "10",
      optionId: "20",
      fillGroupId: "30",
      counterparty: COUNTERPARTY.toText(),
      quantitySats: 200_000,
      premiumSats: 5_000,
      entryPriceCents: 9_500_000,
      strikePriceCents: 10_000_000,
      expiryNs: 1_700_100_000_000_000_000,
      role: "Buyer",
    });
  });

  test("should map OfferAcceptFailed with bigint array conversion", () => {
    // given
    const event = makeCanisterEvent({
      data: { OfferAcceptFailed: { offer_ids: [BigInt(1), BigInt(2)], reason: "no balance" } },
    });

    // when
    const { data } = mapEvent(event);

    // then
    expect(data).toEqual({ type: "OfferAcceptFailed", offerIds: ["1", "2"], reason: "no balance" });
  });

  test("should map OptionSettled with role mapping", () => {
    // given
    const event = makeCanisterEvent({
      data: {
        OptionSettled: {
          option_id: BigInt(99),
          quantity_sats: BigInt(200_000),
          entry_price_cents: BigInt(9_500_000),
          strike_price_cents: BigInt(10_000_000),
          settlement_price_cents: BigInt(10_500_000),
          premium_sats: BigInt(5_000),
          payout_sats: BigInt(210_000),
          accepted_at_ns: BigInt(1_700_000_000_000_000_000),
          settled_at_ns: BigInt(1_700_100_000_000_000_000),
          role: { Writer: null },
        },
      },
    });

    // when
    const { data } = mapEvent(event);

    // then
    expect(data).toEqual({
      type: "OptionSettled",
      optionId: "99",
      quantitySats: 200_000,
      entryPriceCents: 9_500_000,
      strikePriceCents: 10_000_000,
      settlementPriceCents: 10_500_000,
      premiumSats: 5_000,
      payoutSats: 210_000,
      acceptedAtNs: 1_700_000_000_000_000_000,
      settledAtNs: 1_700_100_000_000_000_000,
      role: "Writer",
    });
  });

  test("should map OptionSettlementFailed", () => {
    // given
    const event = makeCanisterEvent({
      data: { OptionSettlementFailed: { option_id: BigInt(99), reason: "price feed unavailable" } },
    });

    // when
    const { data } = mapEvent(event);

    // then
    expect(data).toEqual({
      type: "OptionSettlementFailed",
      optionId: "99",
      reason: "price feed unavailable",
    });
  });

  test("should fall back to Unknown for unrecognized data", () => {
    // given
    const event = makeCanisterEvent({
      data: { Unknown: null } as unknown as CanisterEventData,
    });

    // when
    const { data } = mapEvent(event);

    // then
    expect(data).toEqual({ type: "Unknown" });
  });
});

test("should map multiple events", () => {
  // given
  const events: CanisterEvent[] = [
    makeCanisterEvent({ data: { Deposit: { amount_sats: BigInt(100_000) } } }),
    {
      ...makeCanisterEvent({ data: { Unknown: null } as unknown as CanisterEventData }),
      id: BigInt(2),
    },
  ];

  // when
  const result = mapEvents(events);

  // then
  expect(result).toHaveLength(2);
  expect(result[0].data.type).toBe("Deposit");
  expect(result[1].data.type).toBe("Unknown");
});
