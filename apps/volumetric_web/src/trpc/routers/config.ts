import { getCanisterConfig } from "@/lib/use-cases/config/get-canister-config/usecase";
import { getConfig } from "@/lib/use-cases/config/get-config/usecase";
import { publicProcedure, router } from "../init";

export const configRouter = router({
  getConfig: publicProcedure.query(() => getConfig()),
  getCanisterConfig: publicProcedure.query(() => getCanisterConfig()),
});
