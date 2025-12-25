import type { ActiveOptionStatus, OfferStatus } from "@volumetric/canister-types";
import { z } from "zod";

export const inputSchema = z.object({
  address: z.string().min(1),
});

export type Input = z.infer<typeof inputSchema>;

type VariantKey<T> = T extends Record<string, null> ? keyof T : never;
export type OfferStatusKey = VariantKey<OfferStatus>;
export type ActiveOptionStatusKey = VariantKey<ActiveOptionStatus>;

export interface OfferData {
  id: string;
  status: OfferStatusKey;
  totalQuantity: bigint;
  remainingQuantity: bigint;
  strikeBasisPoints: number;
  premiumBasisPoints: number;
  optionDurationSeconds: bigint;
  offerValidUntil: bigint;
  createdAt: bigint;
}

export interface OptionData {
  id: string;
  status: ActiveOptionStatusKey;
  quantity: bigint;
  entryPriceCents: bigint;
  strikePriceCents: bigint;
  premiumPaid: bigint;
  expiry: bigint;
  acceptedAt: bigint;
  offerId: string;
}

export interface Output {
  offers: OfferData[];
  boughtOptions: OptionData[];
  writtenOptions: OptionData[];
}
