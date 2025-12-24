import type { ActiveOptionStatus, OfferStatus } from "@volumetric/canister-types";
import { z } from "zod";
import { createApiHandler } from "@/lib/api-handler";
import { getCanisterActor } from "@/lib/canister-server";

type VariantKey<T> = T extends unknown ? keyof T : never;
type OfferStatusKey = VariantKey<OfferStatus>;
type ActiveOptionStatusKey = VariantKey<ActiveOptionStatus>;

const RequestSchema = z.object({
  address: z.string().min(1),
});

export type PortfolioRequest = z.infer<typeof RequestSchema>;

export type OfferData = {
  id: string;
  status: OfferStatusKey;
  totalQuantity: string;
  remainingQuantity: string;
  strikeBasisPoints: number;
  premiumBasisPoints: number;
  optionDurationSeconds: string;
  offerValidUntil: string;
  createdAt: string;
};

export type OptionData = {
  id: string;
  status: ActiveOptionStatusKey;
  quantity: string;
  entryPriceCents: string;
  strikePriceCents: string;
  premiumPaid: string;
  expiry: string;
  acceptedAt: string;
  offerId: string;
};

export type PortfolioResponse = {
  offers: OfferData[];
  boughtOptions: OptionData[];
  writtenOptions: OptionData[];
};

function parseOfferStatus(status: Record<string, null>): OfferStatusKey {
  if ("Open" in status) return "Open";
  if ("PartiallyFilled" in status) return "PartiallyFilled";
  if ("Filled" in status) return "Filled";
  if ("Cancelled" in status) return "Cancelled";
  if ("Processing" in status) return "Processing";
  return "Open";
}

function parseOptionStatus(status: Record<string, null>): ActiveOptionStatusKey {
  if ("Active" in status) return "Active";
  if ("Settling" in status) return "Settling";
  if ("Settled" in status) return "Settled";
  if ("Expired" in status) return "Expired";
  return "Active";
}

export const POST = createApiHandler(RequestSchema, async ({ address }) => {
  const actor = await getCanisterActor();

  const [offersResult, boughtResult, writtenResult] = await Promise.all([
    actor.get_my_offers(address),
    actor.get_my_options(address),
    actor.get_my_written_options(address),
  ]);

  const rawOffers = "Ok" in offersResult ? offersResult.Ok : [];
  const boughtOptions = "Ok" in boughtResult ? boughtResult.Ok : [];
  const writtenOptions = "Ok" in writtenResult ? writtenResult.Ok : [];

  const filterActiveOptions = (options: typeof boughtOptions) => {
    return options.filter((option) => {
      const status = parseOptionStatus(option.status as Record<string, null>);
      return status === "Active" || status === "Settling";
    });
  };

  const filterActiveOffers = (offersList: typeof rawOffers) => {
    return offersList.filter((offer) => {
      const status = parseOfferStatus(offer.status as Record<string, null>);
      return status === "Open" || status === "PartiallyFilled" || status === "Processing";
    });
  };

  const offers = filterActiveOffers(rawOffers);

  return {
    offers: offers.map((offer) => ({
      id: offer.id.toString(),
      status: parseOfferStatus(offer.status as Record<string, null>),
      totalQuantity: offer.total_quantity.toString(),
      remainingQuantity: offer.remaining_quantity.toString(),
      strikeBasisPoints: offer.strike_basis_points,
      premiumBasisPoints: offer.premium_basis_points,
      optionDurationSeconds: offer.option_duration_seconds.toString(),
      offerValidUntil: offer.offer_valid_until.toString(),
      createdAt: offer.created_at.toString(),
    })),
    boughtOptions: filterActiveOptions(boughtOptions).map((option) => ({
      id: option.id.toString(),
      status: parseOptionStatus(option.status as Record<string, null>),
      quantity: option.quantity.toString(),
      entryPriceCents: option.entry_price_cents.toString(),
      strikePriceCents: option.strike_price_cents.toString(),
      premiumPaid: option.premium_paid.toString(),
      expiry: option.expiry.toString(),
      acceptedAt: option.accepted_at.toString(),
      offerId: option.offer_id.toString(),
    })),
    writtenOptions: filterActiveOptions(writtenOptions).map((option) => ({
      id: option.id.toString(),
      status: parseOptionStatus(option.status as Record<string, null>),
      quantity: option.quantity.toString(),
      entryPriceCents: option.entry_price_cents.toString(),
      strikePriceCents: option.strike_price_cents.toString(),
      premiumPaid: option.premium_paid.toString(),
      expiry: option.expiry.toString(),
      acceptedAt: option.accepted_at.toString(),
      offerId: option.offer_id.toString(),
    })),
  } satisfies PortfolioResponse;
});
