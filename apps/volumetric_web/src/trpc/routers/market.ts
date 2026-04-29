import { inputSchema as getBtcHistorySchema } from "@/lib/use-cases/market/get-btc-history/schema";
import { getBtcHistory } from "@/lib/use-cases/market/get-btc-history/usecase";
import { getMarketPrices } from "@/lib/use-cases/market/get-prices/usecase";
import { publicProcedure, router } from "../init";

export const marketRouter = router({
  getPrices: publicProcedure.query(() => getMarketPrices()),

  getBtcHistory: publicProcedure
    .input(getBtcHistorySchema)
    .query(({ input }) => getBtcHistory(input)),
});
