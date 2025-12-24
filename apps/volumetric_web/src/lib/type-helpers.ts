import type { ActiveOptionStatus, OfferStatus } from "@volumetric/canister-types";

type VariantKey<T> = T extends unknown ? keyof T : never;

export type OfferStatusKey = VariantKey<OfferStatus>;
export type ActiveOptionStatusKey = VariantKey<ActiveOptionStatus>;

export function getOfferStatusKey(status: OfferStatus): OfferStatusKey {
  if ("Open" in status) return "Open";
  if ("PartiallyFilled" in status) return "PartiallyFilled";
  if ("Filled" in status) return "Filled";
  if ("Cancelled" in status) return "Cancelled";
  if ("Processing" in status) return "Processing";
  return "Open";
}

export function getOptionStatusKey(status: ActiveOptionStatus): ActiveOptionStatusKey {
  if ("Active" in status) return "Active";
  if ("Settling" in status) return "Settling";
  if ("Settled" in status) return "Settled";
  if ("Expired" in status) return "Expired";
  return "Active";
}

export function unwrapOptional<T>(value: [] | [T]): T | null {
  return value.length > 0 ? (value[0] as T) : null;
}
