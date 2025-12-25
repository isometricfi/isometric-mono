import { inputSchema as getPortfolioSchema } from "@/lib/use-cases/portfolio/get-portfolio/schema";
import { getPortfolio } from "@/lib/use-cases/portfolio/get-portfolio/usecase";
import { publicProcedure, router } from "../init";

export const portfolioRouter = router({
  getPortfolio: publicProcedure
    .input(getPortfolioSchema)
    .query(({ input }) => getPortfolio(input.address)),
});
