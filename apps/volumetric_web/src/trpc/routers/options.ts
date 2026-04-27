import { inputSchema as acceptOffersSchema } from "@/lib/use-cases/options/accept-offers/schema";
import { acceptOffers } from "@/lib/use-cases/options/accept-offers/usecase";
import { inputSchema as cancelOfferSchema } from "@/lib/use-cases/options/cancel-offer/schema";
import { cancelOffer } from "@/lib/use-cases/options/cancel-offer/usecase";
import { inputSchema as createOfferSchema } from "@/lib/use-cases/options/create-offer/schema";
import { createOffer } from "@/lib/use-cases/options/create-offer/usecase";
import { listActiveOptions } from "@/lib/use-cases/options/list-active-options/usecase";
import { listOptions } from "@/lib/use-cases/options/list-options/usecase";
import { publicProcedure, router } from "../init";

export const optionsRouter = router({
  listOptions: publicProcedure.query(() => listOptions()),

  listActiveOptions: publicProcedure.query(() => listActiveOptions()),

  createOffer: publicProcedure.input(createOfferSchema).mutation(({ input }) => createOffer(input)),

  acceptOffers: publicProcedure
    .input(acceptOffersSchema)
    .mutation(({ input }) => acceptOffers(input)),

  cancelOffer: publicProcedure.input(cancelOfferSchema).mutation(({ input }) => cancelOffer(input)),
});
