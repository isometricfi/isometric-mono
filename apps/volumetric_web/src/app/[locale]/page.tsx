import type { Metadata } from "next";
import { generatePageMetadata } from "@/lib/metadata";
import { ChainAbstractionSection } from "./_components/ChainAbstractionSection";
import { FinalCtaSection } from "./_components/FinalCtaSection";
import { HeroSection } from "./_components/HeroSection";
import { HowItWorksSection } from "./_components/HowItWorksSection";
import { ProblemSection } from "./_components/ProblemSection";
import { SocialProofStrip } from "./_components/SocialProofStrip";
import { TeamSection } from "./_components/TeamSection";
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
      <div className="w-full md:-mt-20 -mt-10">
        <SocialProofStrip />
      </div>
      <ProblemSection />
      <TwoPathsSection />
      <ChainAbstractionSection />
      <HowItWorksSection />
      <TeamSection />
      <FinalCtaSection />
    </div>
  );
}
