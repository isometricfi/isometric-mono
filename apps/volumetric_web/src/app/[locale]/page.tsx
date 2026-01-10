import type { Metadata } from "next";
import { generatePageMetadata } from "@/lib/metadata";
import { ChainAbstractionSection } from "./_components/ChainAbstractionSection";
import { ConcentricCircles } from "./_components/ConcentricCircles";
import { HeroSection } from "./_components/HeroSection";
import { HowItWorksSection } from "./_components/HowItWorksSection";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  return generatePageMetadata({ params }, "Metadata");
}

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
