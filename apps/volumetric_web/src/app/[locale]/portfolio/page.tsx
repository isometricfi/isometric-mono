import type { Metadata } from "next";
import { generatePageMetadata } from "@/lib/metadata";
import { PortfolioView } from "./_components/PortfolioView";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  return generatePageMetadata({ params }, "Metadata.portfolio");
}

export default function PortfolioPage() {
  return (
    <div className="container mx-auto md:py-5 py-4 max-w-5xl">
      <PortfolioView />
    </div>
  );
}
