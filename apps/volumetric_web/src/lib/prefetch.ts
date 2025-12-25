import { dehydrate, QueryClient } from "@tanstack/react-query";
import { trpc } from "@/trpc/server";

export async function prefetchOptionsPageData() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 10000,
      },
    },
  });

  try {
    const [config, options] = await Promise.all([
      trpc.config.getConfig(),
      trpc.options.listOptions(),
    ]);

    queryClient.setQueryData([["config", "getConfig"]], config);
    queryClient.setQueryData([["options", "listOptions"]], options);
  } catch (error) {
    console.error("[prefetch] error:", error);
  }

  return dehydrate(queryClient);
}
