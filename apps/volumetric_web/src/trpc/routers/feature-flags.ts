import { getPauseMode } from "@/lib/use-cases/feature-flags/get-pause-mode/usecase";
import { publicProcedure, router } from "../init";

export const featureFlagsRouter = router({
  getPauseMode: publicProcedure.query(() => getPauseMode()),
});
