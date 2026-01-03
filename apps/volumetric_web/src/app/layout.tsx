import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Navbar } from "@/components/layout/Navbar";
import { ThemeProvider } from "@/components/layout/ThemeProvider";
import Providers from "./providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://isometric.fi";

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    default: "Isometric | On-Chain Bitcoin Options",
    template: "%s | Isometric",
  },
  description:
    "The simplest way to trade Bitcoin options on-chain. Earn high APY writing calls or get up to 100x leverage as a buyer. Fully trustless, self-custody, no liquidations.",
  keywords: [
    "Bitcoin options",
    "on-chain options",
    "BTC leverage",
    "BTC yield",
    "decentralized options",
    "trustless trading",
    "self custody",
  ],
  authors: [{ name: "Isometric" }],
  creator: "Isometric",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: BASE_URL,
    siteName: "Isometric",
    title: "Isometric | On-Chain Bitcoin Options",
    description:
      "The simplest way to trade Bitcoin options on-chain. Earn high APY writing calls or get up to 100x leverage as a buyer.",
    images: [
      {
        url: "/defaultOG.png",
        width: 1200,
        height: 630,
        alt: "Isometric - On-Chain Bitcoin Options",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Isometric | On-Chain Bitcoin Options",
    description:
      "The simplest way to trade Bitcoin options on-chain. Earn high APY writing calls or get up to 100x leverage as a buyer.",
    images: ["/defaultOG.png"],
  },
  robots: {
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}>
        <ThemeProvider>
          <Providers>
            <div className="px-4">
              <Navbar />
              {children}
            </div>
          </Providers>
        </ThemeProvider>
      </body>
    </html>
  );
}
