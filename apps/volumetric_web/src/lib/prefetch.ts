import { dehydrate, QueryClient } from "@tanstack/react-query";
import { QueryKey } from "@/lib/query-keys";
import type { ConfigData } from "@/types/config";
import type { OptionsData } from "@/types/options";

function getBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_URL) {
    return process.env.NEXT_PUBLIC_URL;
  }
  return "http://localhost:4200";
}

async function fetchConfig(): Promise<ConfigData> {
  const response = await fetch(`${getBaseUrl()}/api/volumetric-config`);
  if (!response.ok) {
    throw new Error("Failed to fetch config");
  }
  return response.json();
}

async function fetchOptions(): Promise<OptionsData> {
  const response = await fetch(`${getBaseUrl()}/api/options`);
  if (!response.ok) {
    throw new Error("Failed to fetch options");
  }
  return response.json();
}

export async function prefetchOptionsPageData() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 10000,
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
