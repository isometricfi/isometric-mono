import { initTRPC } from "@trpc/server";
import { CanisterError, getErrorMessage } from "@volumetric/canister-types";
import { cache } from "react";
import superjson from "superjson";

export const createTRPCContext = cache(async () => {
  return {};
});

const t = initTRPC.create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    const cause = error.cause;
    if (cause instanceof CanisterError) {
      return {
        ...shape,
        message: getErrorMessage(cause) || shape.message,
        data: {
          ...shape.data,
          canisterErrorCode: cause.code,
          canisterErrorName: cause.errorName,
        },
      };
    }
    return shape;
  },
});

export const router = t.router;
export const publicProcedure = t.procedure;
export const createCallerFactory = t.createCallerFactory;
