import type { Metadata } from "next";
import { ChainAbstractionSection } from "./_components/ChainAbstractionSection";
import { ConcentricCircles } from "./_components/ConcentricCircles";
import { HeroSection } from "./_components/HeroSection";
import { HowItWorksSection } from "./_components/HowItWorksSection";

export const metadata: Metadata = {
  title: "On-Chain Bitcoin Options",
  description:
    "The simplest way to trade Bitcoin options on-chain. Earn high APY writing calls or get up to 100x leverage as a buyer.",
  keywords: [
    "Bitcoin options",
    "on-chain options",
    "BTC APY",
    "BTC leverage",
    "decentralized options",
    "trustless trading",
    "self custody",
  ],
  openGraph: {
    type: "website",
    title: "On-Chain Bitcoin Options | Isometric",
    description:
      "The simplest way to trade Bitcoin options on-chain. Earn high APY writing calls or get up to 100x leverage as a buyer.",
    images: [
      {
        url: "/defaultOG.png",
        width: 1200,
        height: 630,
        alt: "Isometric - On-Chain Bitcoin Options",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "On-Chain Bitcoin Options | Isometric",
    description:
      "The simplest way to trade Bitcoin options on-chain. Earn high APY writing calls or get up to 100x leverage.",
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
