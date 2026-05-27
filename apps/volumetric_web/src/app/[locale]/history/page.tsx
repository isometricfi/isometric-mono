import type { Metadata } from "next";
import { generatePageMetadata } from "@/lib/metadata";
import { HistoryView } from "./_components/HistoryView";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  return generatePageMetadata({ params }, "Metadata.history", "/history");
}

export default function HistoryPage() {
  return (
    <div className="container mx-auto md:py-5 py-4 max-w-5xl">
      <HistoryView />
    </div>
  );
}
