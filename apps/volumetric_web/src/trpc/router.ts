import { router } from "./init";
import { accountRouter } from "./routers/account";
import { configRouter } from "./routers/config";
import { historyRouter } from "./routers/history";
import { optionsRouter } from "./routers/options";
import { portfolioRouter } from "./routers/portfolio";
import { testingRouter } from "./routers/testing";

export const appRouter = router({
  account: accountRouter,
  config: configRouter,
  history: historyRouter,
  options: optionsRouter,
  portfolio: portfolioRouter,
  testing: testingRouter,
});

export type AppRouter = typeof appRouter;
