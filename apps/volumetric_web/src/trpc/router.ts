import { router } from "./init";
import { accountRouter } from "./routers/account";
import { configRouter } from "./routers/config";
import { eventsRouter } from "./routers/events";
import { historyRouter } from "./routers/history";
import { optionsRouter } from "./routers/options";
import { portfolioRouter } from "./routers/portfolio";
import { waitlistRouter } from "./routers/waitlist";

export const appRouter = router({
  account: accountRouter,
  config: configRouter,
  events: eventsRouter,
  history: historyRouter,
  options: optionsRouter,
  portfolio: portfolioRouter,
  waitlist: waitlistRouter,
});

export type AppRouter = typeof appRouter;
