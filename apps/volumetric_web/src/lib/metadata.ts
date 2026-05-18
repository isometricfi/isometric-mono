import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { getPathname, routing } from "@/i18n/routing";

const LANDING_PAGE_BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://isometric.fi";
const APP_BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://app.isometric.fi";
const APP_PATHNAMES = new Set(["/buy", "/write", "/portfolio", "/history"]);

type PagePathname = "/" | "/privacy" | "/terms" | "/buy" | "/write" | "/portfolio" | "/history";

export async function generatePageMetadata(
  { params }: { params: Promise<{ locale: string }> },
  namespace: string,
  pathname: PagePathname,
): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace });
  const ogImage = locale === "zh" ? "/defaultOGCN.png" : "/defaultOG.png";
  const pageBaseUrl = getPageBaseUrl(pathname);
  const localizedPathname = getPathname({ href: pathname, locale });
  const canonicalUrl = `${pageBaseUrl}${localizedPathname}`;

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
    alternates: {
      canonical: canonicalUrl,
      languages: {
        ...Object.fromEntries(
          routing.locales.map((alternateLocale) => [
            alternateLocale,
            `${pageBaseUrl}${getPathname({ href: pathname, locale: alternateLocale })}`,
          ]),
        ),
        "x-default": `${pageBaseUrl}${getPathname({ href: pathname, locale: routing.defaultLocale })}`,
      },
    },
    openGraph: {
      type: "website",
      url: canonicalUrl,
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

function getPageBaseUrl(pathname: PagePathname): string {
  if (APP_PATHNAMES.has(pathname)) {
    return APP_BASE_URL;
  }

  return LANDING_PAGE_BASE_URL;
}
