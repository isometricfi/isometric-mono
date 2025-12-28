import "server-only";

import { createCallerFactory, createTRPCContext } from "./init";
import { appRouter } from "./router";

export const createCaller = createCallerFactory(appRouter);

export const trpc = createCaller(createTRPCContext);
