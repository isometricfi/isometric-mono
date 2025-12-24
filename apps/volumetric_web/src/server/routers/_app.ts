import { router } from "../trpc";
import { accountRouter } from "./account";
import { configRouter } from "./config";
import { optionsRouter } from "./options";
import { portfolioRouter } from "./portfolio";

export const appRouter = router({
  account: accountRouter,
  options: optionsRouter,
  config: configRouter,
  portfolio: portfolioRouter,
});

export type AppRouter = typeof appRouter;
