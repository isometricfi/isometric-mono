import { createTRPCClient, httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import type { AppRouter } from "../../volumetric_web/src/trpc/router";
import { getBotTraceHeaders } from "./telemetry.js";

export type TRPCClient = ReturnType<typeof createTRPCClient<AppRouter>>;
export type TRPCFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

interface TRPCClientOptions {
  trpcUrl: string;
  fetch?: TRPCFetch;
}

export function getTRPCClient(options: TRPCClientOptions): TRPCClient {
  return createTRPCClient<AppRouter>({
    links: [
      httpBatchLink({
        url: options.trpcUrl,
        transformer: superjson,
        fetch: options.fetch,
        headers: () => getBotTraceHeaders(),
      }),
    ],
  });
}
