import { HydrationBoundary } from "@tanstack/react-query";
import { prefetchOptionsPageData } from "@/lib/prefetch";
import { BuyOptionsView } from "./_components/BuyOptionsView";

export default async function BuyPage() {
  const dehydratedState = await prefetchOptionsPageData();

  return (
    <HydrationBoundary state={dehydratedState}>
      <div className="container mx-auto py-8 max-w-5xl mt-18">
        <BuyOptionsView />
      </div>
    </HydrationBoundary>
  );
}
