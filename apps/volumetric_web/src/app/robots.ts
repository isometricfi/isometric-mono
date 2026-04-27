import type { MetadataRoute } from "next";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://isometric.fi";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/s/"],
      },
    ],
    sitemap: [`${BASE_URL}/sitemap.xml`, "https://docs.isometric.fi/sitemap.xml"],
  };
}
