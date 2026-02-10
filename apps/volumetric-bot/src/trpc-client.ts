import { createTRPCClient, httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import type { AppRouter } from "../../volumetric_web/src/trpc/router";

let cachedClient: ReturnType<typeof createTRPCClient<AppRouter>> | null = null;

export type TRPCClient = ReturnType<typeof createTRPCClient<AppRouter>>;

export function getTRPCClient(trpcUrl: string): TRPCClient {
  if (cachedClient) {
    return cachedClient;
  }

  cachedClient = createTRPCClient<AppRouter>({
    links: [
      httpBatchLink({
        url: trpcUrl,
        transformer: superjson,
      }),
    ],
  });

  return cachedClient;
}
