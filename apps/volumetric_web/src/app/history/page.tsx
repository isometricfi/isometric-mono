import type { Metadata } from "next";
import { HistoryView } from "./_components/HistoryView";

export const metadata: Metadata = {
  title: "Trade History | Isometric",
  description:
    "View your complete Bitcoin options trading history. Track all your past trades, settlements, and performance. Full transparency with on-chain verification.",
  keywords: [
    "Bitcoin trading history",
    "options history",
    "crypto trading records",
    "BTC trade tracker",
  ],
  openGraph: {
    type: "website",
    title: "Trade History | Isometric",
    description: "View your complete Bitcoin options trading history with full transparency.",
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
    title: "Trade History | Isometric",
    description: "View your complete Bitcoin options trading history with full transparency.",
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
