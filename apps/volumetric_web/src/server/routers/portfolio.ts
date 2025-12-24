import type { ActiveOptionStatus, OfferStatus } from "@volumetric/canister-types";
import { z } from "zod";
import { getCanisterActor } from "@/lib/canister-server";
import { handleCanisterError, publicProcedure, router } from "../trpc";

type VariantKey<T> = T extends unknown ? keyof T : never;
type OfferStatusKey = VariantKey<OfferStatus>;
type ActiveOptionStatusKey = VariantKey<ActiveOptionStatus>;

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

export const portfolioRouter = router({
  get: publicProcedure.input(z.object({ address: z.string().min(1) })).query(async ({ input }) => {
    try {
      const actor = await getCanisterActor();

      const [offersResult, boughtResult, writtenResult] = await Promise.all([
        actor.get_my_offers(input.address),
        actor.get_my_options(input.address),
        actor.get_my_written_options(input.address),
      ]);

      const rawOffers = "Ok" in offersResult ? offersResult.Ok : [];
      const boughtOptions = "Ok" in boughtResult ? boughtResult.Ok : [];
      const writtenOptions = "Ok" in writtenResult ? writtenResult.Ok : [];

      const activeOffers = rawOffers.filter((offer) => {
        const status = parseOfferStatus(offer.status as Record<string, null>);
        return status === "Open" || status === "PartiallyFilled" || status === "Processing";
      });

      const activeBoughtOptions = boughtOptions.filter((option) => {
        const status = parseOptionStatus(option.status as Record<string, null>);
        return status === "Active" || status === "Settling";
      });

      const activeWrittenOptions = writtenOptions.filter((option) => {
        const status = parseOptionStatus(option.status as Record<string, null>);
        return status === "Active" || status === "Settling";
      });

      return {
        offers: activeOffers,
        boughtOptions: activeBoughtOptions,
        writtenOptions: activeWrittenOptions,
      };
    } catch (error) {
      handleCanisterError(error);
    }
  }),
});
