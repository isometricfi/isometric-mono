import "server-only";

import { createTRPCClient, httpBatchLink } from "@trpc/client";
import { createServerSideHelpers } from "@trpc/react-query/server";
import superjson from "superjson";
import type { AppRouter } from "@/server/routers/_app";

function getBaseUrl() {
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  if (process.env.NEXT_PUBLIC_URL) return process.env.NEXT_PUBLIC_URL;
  return `http://localhost:${process.env.PORT ?? 4200}`;
}

/**
 * Server-side tRPC client for use in Server Components
 * Use this for direct calls in RSC (not for prefetching)
 */
export const serverTrpc = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      url: `${getBaseUrl()}/api/trpc`,
      transformer: superjson,
    }),
  ],
});

/**
 * Create server-side helpers for prefetching data
 * Use this in Server Components to prefetch data for client components
 */
export function createSSRHelpers() {
  return createServerSideHelpers<AppRouter>({
    client: serverTrpc,
  });
}
