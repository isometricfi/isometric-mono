import { router } from "./init";
import { accountRouter } from "./routers/account";
import { configRouter } from "./routers/config";
import { eventsRouter } from "./routers/events";
import { featureFlagsRouter } from "./routers/feature-flags";
import { historyRouter } from "./routers/history";
import { marketRouter } from "./routers/market";
import { optionsRouter } from "./routers/options";
import { portfolioRouter } from "./routers/portfolio";
import { waitlistRouter } from "./routers/waitlist";

export const appRouter = router({
  account: accountRouter,
  config: configRouter,
  events: eventsRouter,
  featureFlags: featureFlagsRouter,
  history: historyRouter,
  market: marketRouter,
  options: optionsRouter,
  portfolio: portfolioRouter,
  waitlist: waitlistRouter,
});

export type AppRouter = typeof appRouter;
