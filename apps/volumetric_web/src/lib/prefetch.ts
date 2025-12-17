import { dehydrate, QueryClient } from "@tanstack/react-query";
import { fetchConfig, fetchOptions } from "@/lib/fetchers";
import { QueryKey } from "@/lib/query-keys";

export async function prefetchOptionsPageData() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 10000, // 10 sec
      },
    },
  });

  try {
    const config = await fetchConfig();
    queryClient.setQueryData([QueryKey.Config], config);

    const options = await fetchOptions();
    queryClient.setQueryData([QueryKey.Options], options);
  } catch (error) {
    console.error("[prefetch] error:", error);
  }

  const state = dehydrate(queryClient);

  return state;
}
