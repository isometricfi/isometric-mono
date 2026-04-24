import { initTRPC } from "@trpc/server";
import { cache } from "react";
import superjson from "superjson";

export interface TRPCContext {
  req?: Request;
}

export const createTRPCContext = cache(async (): Promise<TRPCContext> => {
  return {};
});

const t = initTRPC.context<TRPCContext>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;
export const createCallerFactory = t.createCallerFactory;
