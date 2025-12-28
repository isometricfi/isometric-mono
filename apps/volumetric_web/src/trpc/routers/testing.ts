import { inputSchema as forceSettleSchema } from "@/lib/use-cases/testing/force-settle/schema";
import { forceSettle } from "@/lib/use-cases/testing/force-settle/usecase";
import { inputSchema as setOraclePriceSchema } from "@/lib/use-cases/testing/set-oracle-price/schema";
import { setOraclePrice } from "@/lib/use-cases/testing/set-oracle-price/usecase";
import { publicProcedure, router } from "../init";

export const testingRouter = router({
  setOraclePrice: publicProcedure
    .input(setOraclePriceSchema)
    .mutation(({ input }) => setOraclePrice(input)),

  forceSettle: publicProcedure.input(forceSettleSchema).mutation(({ input }) => forceSettle(input)),
});
