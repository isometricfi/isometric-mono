import { initTRPC, TRPCError } from "@trpc/server";
import { CanisterError, getErrorMessage } from "@volumetric/canister-types";
import superjson from "superjson";

export const createTRPCContext = async () => {
  return {};
};

const t = initTRPC.context<typeof createTRPCContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        canisterError:
          error.cause instanceof CanisterError
            ? {
                code: error.cause.code,
                name: error.cause.name,
                message: getErrorMessage(error.cause),
              }
            : null,
      },
    };
  },
});

export const router = t.router;
export const publicProcedure = t.procedure;
export const createCallerFactory = t.createCallerFactory;

export function handleCanisterError(error: unknown): never {
  if (error instanceof CanisterError) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: getErrorMessage(error),
      cause: error,
    });
  }
  throw error;
}
