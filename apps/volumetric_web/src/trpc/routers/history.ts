import { inputSchema as getHistorySchema } from "@/lib/use-cases/history/get-history/schema";
import { getHistory } from "@/lib/use-cases/history/get-history/usecase";
import { inputSchema as getHistoryByHashSchema } from "@/lib/use-cases/history/get-history-by-hash/schema";
import { getHistoryByHash } from "@/lib/use-cases/history/get-history-by-hash/usecase";
import { publicProcedure, router } from "../init";

export const historyRouter = router({
  getHistory: publicProcedure
    .input(getHistorySchema)
    .query(({ input }) => getHistory(input.address)),
  getHistoryByHash: publicProcedure
    .input(getHistoryByHashSchema)
    .query(({ input }) => getHistoryByHash(input.principalHash)),
});
