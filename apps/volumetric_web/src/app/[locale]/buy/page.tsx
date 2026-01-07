export const dynamic = "force-dynamic";

import { HydrationBoundary } from "@tanstack/react-query";
import type { Metadata } from "next";
import { prefetchOptionsPageData } from "@/lib/prefetch";
import { BuyOptionsView } from "./_components/BuyOptionsView";

export const metadata: Metadata = {
  title: "Buy Bitcoin Options",
  description:
    "Get up to 100x leverage on Bitcoin with no liquidation risk. Your max loss is the premium paid. Fully on-chain and trustless.",
  keywords: [
    "buy Bitcoin options",
    "BTC leverage",
    "no liquidation",
    "on-chain options",
    "trustless leverage",
  ],
  openGraph: {
    type: "website",
    title: "Buy Bitcoin Options | Isometric",
    description:
      "Get up to 100x leverage on Bitcoin with no liquidation risk. Your max loss is the premium paid. Fully on-chain and trustless.",
    images: [
      {
        url: "/defaultOG.png",
        width: 1200,
        height: 630,
        alt: "Buy Bitcoin Options on Isometric",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Buy Bitcoin Options | Isometric",
    description:
      "Get up to 100x leverage on Bitcoin with no liquidation risk. Your max loss is the premium paid. Fully on-chain and trustless.",
    images: ["/defaultOG.png"],
  },
};

export default async function BuyPage() {
  const dehydratedState = await prefetchOptionsPageData();

  return (
    <HydrationBoundary state={dehydratedState}>
      <div className="container mx-auto py-8 max-w-5xl md:mt-16 mt-14">
        <BuyOptionsView />
      </div>
    </HydrationBoundary>
  );
}
