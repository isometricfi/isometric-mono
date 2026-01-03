import type { MetadataRoute } from "next";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://isometric.finance";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/testing/", "/s/"],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
