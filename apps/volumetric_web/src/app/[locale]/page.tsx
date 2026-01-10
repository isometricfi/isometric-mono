import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ChainAbstractionSection } from "./_components/ChainAbstractionSection";
import { ConcentricCircles } from "./_components/ConcentricCircles";
import { HeroSection } from "./_components/HeroSection";
import { HowItWorksSection } from "./_components/HowItWorksSection";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Metadata" });

  const ogImage = locale === "zh" ? "/defaultOGCN.png" : "/defaultOG.png";

  return {
    title: t("title"),
    description: t("description"),
    keywords: t("keywords")
      .split(",")
      .map((k) => k.trim()),
    openGraph: {
      type: "website",
      title: t("title"),
      description: t("description"),
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: t("ogImageAlt"),
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: t("title"),
      description: t("description"),
      images: [ogImage],
    },
  };
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
