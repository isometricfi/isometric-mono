import { ConcentricCircles } from "@/components/landing/concentric-circles";
import { HeroSection } from "@/components/landing/hero-section";
import { ChainAbstractionSection } from "@/components/landing/chain-abstraction-section";
import { HowItWorksSection } from "@/components/landing/how-it-works-section";

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
