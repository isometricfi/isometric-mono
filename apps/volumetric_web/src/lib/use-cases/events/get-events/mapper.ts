import type {
  Event as CanisterEvent,
  EventData as CanisterEventData,
  EventType as CanisterEventType,
  TradeRole as CanisterTradeRole,
} from "@volumetric/canister-types";
import type { Event, EventData, EventType, TradeRole } from "./schema";

const getVariantKey = <T extends Record<string, unknown>>(variant: T): keyof T =>
  Object.keys(variant)[0] as keyof T;

const mapTradeRole = (role: CanisterTradeRole): TradeRole => getVariantKey(role) as TradeRole;

const mapEventType = (eventType: CanisterEventType): EventType =>
  getVariantKey(eventType) as EventType;

function mapEventData(data: CanisterEventData): EventData {
  if ("AccountCreated" in data) {
    const d = data.AccountCreated;
    return { type: "AccountCreated", walletAddress: d.wallet_address };
  }
  if ("UsernameUpdated" in data) {
    const d = data.UsernameUpdated;
    return {
      type: "UsernameUpdated",
      oldUsername: d.old_username[0] ?? null,
      newUsername: d.new_username,
    };
  }
  if ("Deposit" in data) {
    const d = data.Deposit;
    return { type: "Deposit", amountSats: Number(d.amount_sats) };
  }
  if ("Withdrawal" in data) {
    const d = data.Withdrawal;
    return { type: "Withdrawal", amountSats: Number(d.amount_sats), destination: d.destination };
  }
  if ("WithdrawalFailed" in data) {
    const d = data.WithdrawalFailed;
    return { type: "WithdrawalFailed", amountSats: Number(d.amount_sats), reason: d.reason };
  }
  if ("OfferCreated" in data) {
    const d = data.OfferCreated;
    return {
      type: "OfferCreated",
      offerId: d.offer_id.toString(),
      quantitySats: Number(d.quantity_sats),
      strikeBasisPoints: d.strike_basis_points,
      premiumBasisPoints: d.premium_basis_points,
      durationSeconds: Number(d.duration_seconds),
      offerValidUntilSeconds: Number(d.offer_valid_until_seconds),
    };
  }
  if ("OfferCancelled" in data) {
    const d = data.OfferCancelled;
    return {
      type: "OfferCancelled",
      offerId: d.offer_id.toString(),
      remainingQuantitySats: Number(d.remaining_quantity_sats),
    };
  }
  if ("OfferAccepted" in data) {
    const d = data.OfferAccepted;
    return {
      type: "OfferAccepted",
      offerId: d.offer_id.toString(),
      optionId: d.option_id.toString(),
      fillGroupId: d.fill_group_id.toString(),
      counterparty: d.counterparty.toText(),
      quantitySats: Number(d.quantity_sats),
      premiumSats: Number(d.premium_sats),
      entryPriceCents: Number(d.entry_price_cents),
      strikePriceCents: Number(d.strike_price_cents),
      expirySeconds: Number(d.expiry_seconds),
      role: mapTradeRole(d.role),
    };
  }
  if ("OfferAcceptFailed" in data) {
    const d = data.OfferAcceptFailed;
    return {
      type: "OfferAcceptFailed",
      offerIds: Array.from(d.offer_ids, (id) => id.toString()),
      reason: d.reason,
    };
  }
  if ("OptionSettled" in data) {
    const d = data.OptionSettled;
    return {
      type: "OptionSettled",
      optionId: d.option_id.toString(),
      quantitySats: Number(d.quantity_sats),
      entryPriceCents: Number(d.entry_price_cents),
      strikePriceCents: Number(d.strike_price_cents),
      settlementPriceCents: Number(d.settlement_price_cents),
      premiumSats: Number(d.premium_sats),
      payoutSats: Number(d.payout_sats),
      acceptedAtSeconds: Number(d.accepted_at_seconds),
      settledAtSeconds: Number(d.settled_at_seconds),
      role: mapTradeRole(d.role),
    };
  }
  if ("OptionSettlementFailed" in data) {
    const d = data.OptionSettlementFailed;
    return {
      type: "OptionSettlementFailed",
      optionId: d.option_id.toString(),
      reason: d.reason,
    };
  }
  return { type: "Unknown" };
}

export function mapEvent(event: CanisterEvent): Event {
  return {
    id: event.id.toString(),
    eventType: mapEventType(event.event_type),
    principal: event.principal.toText(),
    timestamp: Number(event.timestamp_seconds),
    data: mapEventData(event.data),
  };
}

export function mapEvents(events: CanisterEvent[]): Event[] {
  return events.map(mapEvent);
}
