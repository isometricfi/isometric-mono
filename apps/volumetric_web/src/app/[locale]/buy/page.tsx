export const dynamic = "force-dynamic";

import { HydrationBoundary } from "@tanstack/react-query";
import type { Metadata } from "next";
import { generatePageMetadata } from "@/lib/metadata";
import { prefetchOptionsPageData } from "@/lib/prefetch";
import { BuyOptionsView } from "./_components/BuyOptionsView";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  return generatePageMetadata({ params }, "Metadata.buy");
}

export default async function BuyPage() {
  const dehydratedState = await prefetchOptionsPageData();

  return (
    <HydrationBoundary state={dehydratedState}>
      <div className="container mx-auto md:py-5 py-4 max-w-5xl ">
        <BuyOptionsView />
      </div>
    </HydrationBoundary>
  );
}
