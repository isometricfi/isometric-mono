import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { createSSRHelpers } from "@/lib/trpc-server";
import { BuyOptionsView } from "./_components/BuyOptionsView";

export default async function BuyPage() {
  const helpers = createSSRHelpers();

  await Promise.all([helpers.options.list.prefetch(), helpers.config.get.prefetch()]);

  return (
    <HydrationBoundary state={dehydrate(helpers.queryClient)}>
      <div className="container mx-auto py-8 max-w-5xl mt-20">
        <BuyOptionsView />
      </div>
    </HydrationBoundary>
  );
}
