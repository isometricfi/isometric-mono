import type { Metadata } from "next";
import { generatePageMetadata } from "@/lib/metadata";
import { ChainAbstractionSection } from "./_components/ChainAbstractionSection";
import { HeroSection } from "./_components/HeroSection";
import { HowItWorksSection } from "./_components/HowItWorksSection";
import { TwoPathsSection } from "./_components/TwoPathsSection";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  return generatePageMetadata({ params }, "Metadata");
}

export default function Home() {
  return (
    <div className="relative">
      <HeroSection />
      <TwoPathsSection />
      <ChainAbstractionSection />
      <HowItWorksSection />
    </div>
  );
}
