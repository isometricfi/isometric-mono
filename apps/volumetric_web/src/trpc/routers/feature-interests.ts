import { inputSchema as getFeatureInterestStatusSchema } from "@/lib/use-cases/feature-interests/get-feature-interest-status/schema";
import { getFeatureInterestStatus } from "@/lib/use-cases/feature-interests/get-feature-interest-status/usecase";
import { inputSchema as voteFeatureInterestSchema } from "@/lib/use-cases/feature-interests/vote-feature-interest/schema";
import { voteFeatureInterest } from "@/lib/use-cases/feature-interests/vote-feature-interest/usecase";
import { publicProcedure, router } from "../init";

export const featureInterestsRouter = router({
  getStatus: publicProcedure
    .input(getFeatureInterestStatusSchema)
    .query(({ input }) => getFeatureInterestStatus(input)),
  vote: publicProcedure
    .input(voteFeatureInterestSchema)
    .mutation(({ input }) => voteFeatureInterest(input)),
});
