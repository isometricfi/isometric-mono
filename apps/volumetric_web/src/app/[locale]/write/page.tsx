import type { Metadata } from "next";
import { PauseModeNotice } from "@/components/PauseModeNotice";
import { generatePageMetadata } from "@/lib/metadata";
import { isPauseMode } from "@/lib/site-links";
import { WriteOptionsView } from "./_components/WriteOptionsView";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  return generatePageMetadata({ params }, "Metadata.write");
}

export default function WritePage() {
  return (
    <div className="container mx-auto md:py-5 py-4 max-w-5xl ">
      {isPauseMode() ? <PauseModeNotice /> : <WriteOptionsView />}
    </div>
  );
}
