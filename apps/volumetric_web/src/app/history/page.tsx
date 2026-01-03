import type { Metadata } from "next";
import { HistoryView } from "./_components/HistoryView";

export const metadata: Metadata = {
  title: "History",
  description:
    "View your complete on-chain Bitcoin options history. All trades and settlements are verifiable on-chain with full transparency.",
  keywords: [
    "Bitcoin trading history",
    "on-chain history",
    "options settlements",
    "verifiable trades",
  ],
  openGraph: {
    type: "website",
    title: "History | Isometric",
    description:
      "View your complete on-chain Bitcoin options history. All trades and settlements are verifiable on-chain.",
    images: [
      {
        url: "/defaultOG.png",
        width: 1200,
        height: 630,
        alt: "Isometric Trade History",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "History | Isometric",
    description:
      "View your complete on-chain Bitcoin options history. All trades and settlements are verifiable on-chain.",
    images: ["/defaultOG.png"],
  },
};

export default function HistoryPage() {
  return (
    <div className="container mx-auto py-8 max-w-5xl mt-18">
      <HistoryView />
    </div>
  );
}
