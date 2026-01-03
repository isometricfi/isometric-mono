import type { Metadata } from "next";
import { PortfolioView } from "./_components/PortfolioView";

export const metadata: Metadata = {
  title: "Portfolio",
  description:
    "Track your on-chain Bitcoin options positions. View active contracts, pending offers, and performance. Auto-settlement at expiry.",
  keywords: [
    "Bitcoin portfolio",
    "options positions",
    "on-chain portfolio",
    "BTC options tracking",
  ],
  openGraph: {
    type: "website",
    title: "Portfolio | Isometric",
    description:
      "Track your on-chain Bitcoin options positions. View active contracts, pending offers, and performance.",
    images: [
      {
        url: "/defaultOG.png",
        width: 1200,
        height: 630,
        alt: "Isometric Portfolio",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Portfolio | Isometric",
    description:
      "Track your on-chain Bitcoin options positions. View active contracts, pending offers, and performance.",
    images: ["/defaultOG.png"],
  },
};

export default function PortfolioPage() {
  return (
    <div className="container mx-auto py-8 max-w-5xl mt-18">
      <PortfolioView />
    </div>
  );
}
