import type { ActiveOption, Offer } from "@volumetric/canister-types";
import type { ActiveOptionStatusKey, OfferData, OfferStatusKey, OptionData } from "./schema";

const getStatusKey = <T extends Record<string, null>>(status: T): keyof T =>
  Object.keys(status)[0] as keyof T;

const ACTIVE_OFFER_STATUSES: Set<OfferStatusKey> = new Set([
  "Open",
  "PartiallyFilled",
  "Processing",
]);
const ACTIVE_OPTION_STATUSES: Set<ActiveOptionStatusKey> = new Set(["Active", "Settling"]);

export function isActiveOffer(offer: Offer): boolean {
  return ACTIVE_OFFER_STATUSES.has(getStatusKey(offer.status));
}

export function isActiveOption(option: ActiveOption): boolean {
  return ACTIVE_OPTION_STATUSES.has(getStatusKey(option.status));
}

export function mapOffer(offer: Offer): OfferData {
  return {
    id: offer.id.toString(),
    status: getStatusKey(offer.status),
    totalQuantity: offer.total_quantity,
    remainingQuantity: offer.remaining_quantity,
    strikeBasisPoints: offer.strike_basis_points,
    premiumBasisPoints: offer.premium_basis_points,
    optionDurationSeconds: offer.option_duration_seconds,
    offerValidUntil: offer.offer_valid_until,
    createdAt: offer.created_at,
  };
}

export function mapOption(option: ActiveOption): OptionData {
  return {
    id: option.id.toString(),
    status: getStatusKey(option.status),
    quantity: option.quantity,
    entryPriceCents: option.entry_price_cents,
    strikePriceCents: option.strike_price_cents,
    premiumPaid: option.premium_paid,
    expiry: option.expiry,
    acceptedAt: option.accepted_at,
    offerId: option.offer_id.toString(),
  };
}
