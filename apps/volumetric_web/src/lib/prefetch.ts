import { dehydrate, QueryClient } from "@tanstack/react-query";
import { createTRPCContext } from "@/trpc/init";
import { createCaller } from "@/trpc/server";

export async function prefetchOptionsPageData() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { staleTime: 10_000 } },
  });

  try {
    const caller = createCaller(await createTRPCContext());

    const [config, options] = await Promise.all([
      caller.config.getConfig(),
      caller.options.listOptions(),
    ]);

    queryClient.setQueryData([["config", "getConfig"], { type: "query" }], config);
    queryClient.setQueryData([["options", "listOptions"], { type: "query" }], options);
  } catch (error) {
    console.error("[prefetch] error:", error);
  }

  const dehydrated = dehydrate(queryClient);

  return dehydrated;
}
