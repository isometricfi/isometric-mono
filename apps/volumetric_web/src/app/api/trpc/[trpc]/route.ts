import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { withWebSpan } from "@/lib/telemetry";
import { createTRPCContext } from "@/trpc/init";
import { appRouter } from "@/trpc/router";

const handler = (req: Request) =>
  withWebSpan(
    "web.api.trpc",
    {
      method: req.method,
      pathname: new URL(req.url).pathname,
    },
    async () =>
      fetchRequestHandler({
        endpoint: "/api/trpc",
        req,
        router: appRouter,
        createContext: createTRPCContext,
      }),
  );

export { handler as GET, handler as POST };
