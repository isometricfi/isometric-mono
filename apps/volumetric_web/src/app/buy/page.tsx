import { HydrationBoundary } from "@tanstack/react-query";
import type { Metadata } from "next";
import { prefetchOptionsPageData } from "@/lib/prefetch";
import { BuyOptionsView } from "./_components/BuyOptionsView";

export const metadata: Metadata = {
  title: "Buy Bitcoin Options | Isometric",
  description:
    "Get up to 100x leverage without liquidation risk. Browse and buy Bitcoin call and put options with defined risk. Asymmetric exposure with max loss limited to premium.",
  keywords: [
    "buy Bitcoin options",
    "BTC call options",
    "BTC leverage",
    "options without liquidation",
    "crypto leverage",
  ],
  openGraph: {
    type: "website",
    title: "Buy Bitcoin Options | Isometric",
    description:
      "Get leverage without liquidation. Browse and buy Bitcoin call and put options with defined risk.",
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
      "Get leverage without liquidation. Browse and buy Bitcoin call and put options with defined risk.",
    images: ["/defaultOG.png"],
  },
};

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
