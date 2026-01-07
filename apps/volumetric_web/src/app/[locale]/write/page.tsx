import { HydrationBoundary } from "@tanstack/react-query";
import type { Metadata } from "next";
import { prefetchOptionsPageData } from "@/lib/prefetch";
import { WriteOptionsView } from "./_components/WriteOptionsView";

export const metadata: Metadata = {
  title: "Write Bitcoin Options",
  description:
    "Earn high APY on your Bitcoin by writing call options. Collect premium instantly and let your BTC work for you. Fully on-chain and trustless.",
  keywords: [
    "write Bitcoin options",
    "BTC APY",
    "BTC yield",
    "earn on Bitcoin",
    "on-chain yield",
    "trustless yield",
  ],
  openGraph: {
    type: "website",
    title: "Write Bitcoin Options | Isometric",
    description:
      "Earn high APY on your Bitcoin by writing call options. Collect premium instantly. Fully on-chain and trustless.",
    images: [
      {
        url: "/defaultOG.png",
        width: 1200,
        height: 630,
        alt: "Write Bitcoin Options on Isometric",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Write Bitcoin Options | Isometric",
    description:
      "Earn high APY on your Bitcoin by writing call options. Collect premium instantly. Fully on-chain and trustless.",
    images: ["/defaultOG.png"],
  },
};

export default async function WritePage() {
  const dehydratedState = await prefetchOptionsPageData();

  return (
    <HydrationBoundary state={dehydratedState}>
      <div className="container mx-auto py-8 max-w-5xl md:mt-16 mt-14">
        <WriteOptionsView />
      </div>
    </HydrationBoundary>
  );
}
