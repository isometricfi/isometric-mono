import { inputSchema as getHistorySchema } from "@/lib/use-cases/history/get-history/schema";
import { getHistory } from "@/lib/use-cases/history/get-history/usecase";
import { publicProcedure, router } from "../init";

export const historyRouter = router({
  getHistory: publicProcedure
    .input(getHistorySchema)
    .query(({ input }) => getHistory(input.address)),
});
