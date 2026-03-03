import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { withWebRemoteParentSpan } from "@/lib/telemetry";
import { createTRPCContext } from "@/trpc/init";
import { appRouter } from "@/trpc/router";

function extractTraceHeaders(req: Request): Record<string, string | undefined> {
  return { traceparent: req.headers.get("traceparent") ?? undefined };
}

const handler = (req: Request) =>
  withWebRemoteParentSpan(
    "web.api.trpc",
    extractTraceHeaders(req),
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
