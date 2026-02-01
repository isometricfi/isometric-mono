import type { Metadata } from "next";
import { generatePageMetadata } from "@/lib/metadata";
import { SupportForm } from "./_components/SupportForm";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  return generatePageMetadata({ params }, "Metadata.support");
}

export default function SupportPage() {
  return (
    <div className="container mx-auto py-8 max-w-2xl mt-18">
      <SupportForm />
    </div>
  );
}
