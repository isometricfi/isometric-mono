import { router } from "./init";
import { waitlistRouter } from "./routers/waitlist";

export const appRouter = router({
  waitlist: waitlistRouter,
});

export type AppRouter = typeof appRouter;
