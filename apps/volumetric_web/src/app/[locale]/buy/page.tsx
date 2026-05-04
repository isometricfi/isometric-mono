import type { Metadata } from "next";
import { PauseModeNotice } from "@/components/PauseModeNotice";
import { generatePageMetadata } from "@/lib/metadata";
import { isPauseMode } from "@/lib/site-links";
import { BuyOptionsView } from "./_components/BuyOptionsView";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  return generatePageMetadata({ params }, "Metadata.buy");
}

export default function BuyPage() {
  return (
    <div className="container mx-auto md:py-5 py-4 max-w-5xl ">
      {isPauseMode() ? <PauseModeNotice /> : <BuyOptionsView />}
    </div>
  );
}
