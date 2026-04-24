import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { cookies, headers } from "next/headers";
import { notFound } from "next/navigation";
import Script from "next/script";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations, setRequestLocale } from "next-intl/server";
import { Footer } from "@/components/layout/Footer";
import { Navbar } from "@/components/layout/Navbar";
import { PRO_MODE_COOKIE, ProModeProvider } from "@/components/layout/ProModeProvider";
import { ThemeProvider } from "@/components/layout/ThemeProvider";
import { routing } from "@/i18n/routing";
import Providers from "../providers";
import "../globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://isometric.fi";
const TAWK_EMBED_URL = process.env.NEXT_PUBLIC_TAWK_EMBED_URL;

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Metadata" });

  const title = t("title");
  const description = t("description");
  const keywords = t("keywords");
  const ogImage = locale === "zh" ? "/defaultOGCN.png" : "/defaultOG.png";

  const appHost = process.env.NEXT_PUBLIC_APP_HOST;
  const requestHost = (await headers()).get("host") ?? "";
  const isAppHost = appHost != null && appHost !== "" && requestHost === appHost;

  return {
    metadataBase: new URL(BASE_URL),
    title: {
      default: title,
      template: `%s | ${t("siteName")}`,
    },
    description,
    keywords: keywords.split(",").map((k) => k.trim()),
    authors: [{ name: "Isometric" }],
    creator: "Isometric",
    openGraph: {
      type: "website",
      locale: locale === "zh" ? "zh_CN" : "en_US",
      url: BASE_URL,
      siteName: t("siteName"),
      title,
      description,
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
      title,
      description,
      images: [ogImage],
    },
    robots: isAppHost
      ? {
          index: false,
          follow: false,
          googleBot: { index: false, follow: false },
        }
      : {
          index: true,
          follow: true,
          googleBot: {
            index: true,
            follow: true,
            "max-video-preview": -1,
            "max-image-preview": "large",
            "max-snippet": -1,
          },
        },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!routing.locales.includes(locale as (typeof routing.locales)[number])) {
    notFound();
  }

  setRequestLocale(locale);

  const messages = await getMessages();
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  const cookieStore = await cookies();
  const initialProMode = cookieStore.get(PRO_MODE_COOKIE)?.value === "1";

  return (
    <html lang={locale} suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}>
        {TAWK_EMBED_URL && (
          <>
            <Script id="tawk-api-init" strategy="lazyOnload" nonce={nonce}>
              {`window.Tawk_API = window.Tawk_API || {};
              window.Tawk_API.onLoad = function () {
                window.Tawk_API.hideWidget();
              };
              window.Tawk_API.onChatMinimized = function () {
                window.Tawk_API.hideWidget();
              };
              window.Tawk_API.onChatMessageAgent = function () {
                window.Tawk_API.showWidget();
              };
              window.Tawk_LoadStart = new Date();`}
            </Script>
            <Script
              id="tawk-embed"
              src={TAWK_EMBED_URL}
              strategy="lazyOnload"
              nonce={nonce}
              crossOrigin="anonymous"
            />
          </>
        )}
        <NextIntlClientProvider messages={messages}>
          <ThemeProvider nonce={nonce}>
            <ProModeProvider initial={initialProMode}>
              <Providers>
                <div className="flex min-h-screen flex-col px-4">
                  <Navbar />
                  <main className="flex-1">{children}</main>
                  <Footer />
                </div>
              </Providers>
            </ProModeProvider>
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
