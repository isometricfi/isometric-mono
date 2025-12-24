import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { createSSRHelpers } from "@/lib/trpc-server";
import { WriteOptionsView } from "./_components/WriteOptionsView";

export default async function WritePage() {
  const helpers = createSSRHelpers();

  // Prefetch data on the server
  await Promise.all([helpers.options.list.prefetch(), helpers.config.get.prefetch()]);

  return (
    <HydrationBoundary state={dehydrate(helpers.queryClient)}>
      <div className="container mx-auto py-8 max-w-5xl mt-20">
        <WriteOptionsView />
      </div>
    </HydrationBoundary>
  );
}
