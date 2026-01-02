import type { Metadata } from "next";
import { ChainAbstractionSection } from "./_components/ChainAbstractionSection";
import { ConcentricCircles } from "./_components/ConcentricCircles";
import { HeroSection } from "./_components/HeroSection";
import { HowItWorksSection } from "./_components/HowItWorksSection";

export const metadata: Metadata = {
  title: "Isometric - Bitcoin Options For Everyone",
  description:
    "On-chain Bitcoin options trading with no intermediaries and no counterparty risk. Earn high APY writing calls or get up to 100x leverage as a buyer. Instant settlement.",
  keywords: [
    "Bitcoin options",
    "BTC options",
    "write calls",
    "BTC APY",
    "crypto leverage",
    "options trading",
    "decentralized",
  ],
  openGraph: {
    type: "website",
    title: "Isometric - Bitcoin Options For Everyone",
    description:
      "On-chain Bitcoin options trading with no intermediaries and no counterparty risk. Earn high APY or get leverage without liquidation.",
    images: [
      {
        url: "/defaultOG.png",
        width: 1200,
        height: 630,
        alt: "Isometric - Bitcoin Options Trading",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Isometric - Bitcoin Options For Everyone",
    description:
      "On-chain Bitcoin options trading. Earn APY writing calls or get leverage without liquidation.",
    images: ["/defaultOG.png"],
  },
};

export default function Home() {
  return (
    <div className="relative mt-16 min-h-screen overflow-hidden">
      <ConcentricCircles />
      <HeroSection />
      <ChainAbstractionSection />
      <HowItWorksSection />
    </div>
  );
}
