import { HydrationBoundary } from "@tanstack/react-query";
import { prefetchOptionsPageData } from "@/lib/prefetch";
import { WriteOptionsView } from "./_components/WriteOptionsView";

export default async function WritePage() {
  const dehydratedState = await prefetchOptionsPageData();

  return (
    <HydrationBoundary state={dehydratedState}>
      <div className="container mx-auto py-8 max-w-5xl mt-18">
        <WriteOptionsView />
      </div>
    </HydrationBoundary>
  );
}
