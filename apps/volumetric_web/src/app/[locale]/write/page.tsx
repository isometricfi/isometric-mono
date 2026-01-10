export const dynamic = "force-dynamic";

import { HydrationBoundary } from "@tanstack/react-query";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { prefetchOptionsPageData } from "@/lib/prefetch";
import { WriteOptionsView } from "./_components/WriteOptionsView";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Metadata.write" });

  const ogImage = locale === "zh" ? "/defaultOGCN.png" : "/defaultOG.png";

  return {
    title: t("title"),
    description: t("description"),
    keywords: t("keywords")
      .split(",")
      .map((k) => k.trim()),
    openGraph: {
      type: "website",
      title: t("ogTitle"),
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
      title: t("ogTitle"),
      description: t("description"),
      images: [ogImage],
    },
  };
}

export default async function WritePage() {
  const dehydratedState = await prefetchOptionsPageData();

  return (
    <HydrationBoundary state={dehydratedState}>
      <div className="container mx-auto py-8 max-w-5xl md:mt-16 mt-14">
        <WriteOptionsView />
      </div>
    </HydrationBoundary>
  );
}
