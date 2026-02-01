import { router } from "./init";
import { accountRouter } from "./routers/account";
import { configRouter } from "./routers/config";
import { eventsRouter } from "./routers/events";
import { historyRouter } from "./routers/history";
import { optionsRouter } from "./routers/options";
import { portfolioRouter } from "./routers/portfolio";
import { supportRouter } from "./routers/support";
import { testingRouter } from "./routers/testing";

export const appRouter = router({
  account: accountRouter,
  config: configRouter,
  events: eventsRouter,
  history: historyRouter,
  options: optionsRouter,
  portfolio: portfolioRouter,
  support: supportRouter,
  testing: testingRouter,
});

export type AppRouter = typeof appRouter;
