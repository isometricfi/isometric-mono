import type { Metadata } from "next";
import { PortfolioView } from "./_components/PortfolioView";

export const metadata: Metadata = {
  title: "Portfolio | Isometric",
  description:
    "View your Bitcoin options trading portfolio. Track open positions, P&L, and active yield from writing calls. Instant settlement and real-time updates.",
  keywords: [
    "Bitcoin portfolio",
    "options portfolio",
    "BTC P&L",
    "options tracking",
    "crypto portfolio",
  ],
  openGraph: {
    type: "website",
    title: "Portfolio | Isometric",
    description: "View your Bitcoin options trading portfolio with instant settlement.",
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
    description: "View your Bitcoin options trading portfolio with instant settlement.",
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
