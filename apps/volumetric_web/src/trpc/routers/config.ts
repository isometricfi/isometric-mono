import { getConfig } from "@/lib/use-cases/config/get-config/usecase";
import { publicProcedure, router } from "../init";

export const configRouter = router({
  getConfig: publicProcedure.query(() => getConfig()),
});
