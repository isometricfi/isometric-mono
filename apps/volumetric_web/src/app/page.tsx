import { ConcentricCircles } from "./_components/ConcentricCircles";
import { HeroSection } from "./_components/HeroSection";
import { ChainAbstractionSection } from "./_components/ChainAbstractionSection";
import { HowItWorksSection } from "./_components/HowItWorksSection";

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
