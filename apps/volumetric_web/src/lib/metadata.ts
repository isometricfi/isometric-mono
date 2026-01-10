import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

export async function generatePageMetadata(
  { params }: { params: Promise<{ locale: string }> },
  namespace: string,
): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace });
  const ogImage = locale === "zh" ? "/defaultOGCN.png" : "/defaultOG.png";

  const pageTitle = t("title");
  const description = t("description");
  const keywords = t("keywords")
    .split(",")
    .map((k) => k.trim());
  const ogImageAlt = t("ogImageAlt");

  // Use ogTitle if it exists, otherwise fallback to title
  const ogTitle = t.has("ogTitle") ? t("ogTitle") : pageTitle;

  return {
    title: pageTitle,
    description,
    keywords,
    openGraph: {
      type: "website",
      title: ogTitle,
      description,
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: ogImageAlt,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: ogTitle,
      description,
      images: [ogImage],
    },
  };
}
