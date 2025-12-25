import type { ActiveOptionStatus, OfferStatus } from "@volumetric/canister-types";
import { z } from "zod";

type VariantKey<T> = T extends Record<string, null> ? keyof T : never;
export type OfferStatusKey = VariantKey<OfferStatus>;
export type ActiveOptionStatusKey = VariantKey<ActiveOptionStatus>;

// Request
export const PortfolioRequestSchema = z.object({
  address: z.string().min(1),
});

export type PortfolioRequest = z.infer<typeof PortfolioRequestSchema>;

// Response
export const OfferDataSchema = z.object({
  id: z.string(),
  status: z.string(),
  totalQuantity: z.bigint(),
  remainingQuantity: z.bigint(),
  strikeBasisPoints: z.number(),
  premiumBasisPoints: z.number(),
  optionDurationSeconds: z.bigint(),
  offerValidUntil: z.bigint(),
  createdAt: z.bigint(),
});

export const OptionDataSchema = z.object({
  id: z.string(),
  status: z.string(),
  quantity: z.bigint(),
  entryPriceCents: z.bigint(),
  strikePriceCents: z.bigint(),
  premiumPaid: z.bigint(),
  expiry: z.bigint(),
  acceptedAt: z.bigint(),
  offerId: z.string(),
});

export const PortfolioResponseSchema = z.object({
  offers: z.array(OfferDataSchema),
  boughtOptions: z.array(OptionDataSchema),
  writtenOptions: z.array(OptionDataSchema),
});

export type OfferData = {
  id: string;
  status: OfferStatusKey;
  totalQuantity: bigint;
  remainingQuantity: bigint;
  strikeBasisPoints: number;
  premiumBasisPoints: number;
  optionDurationSeconds: bigint;
  offerValidUntil: bigint;
  createdAt: bigint;
};

export type OptionData = {
  id: string;
  status: ActiveOptionStatusKey;
  quantity: bigint;
  entryPriceCents: bigint;
  strikePriceCents: bigint;
  premiumPaid: bigint;
  expiry: bigint;
  acceptedAt: bigint;
  offerId: string;
};

export type PortfolioResponse = {
  offers: OfferData[];
  boughtOptions: OptionData[];
  writtenOptions: OptionData[];
};
