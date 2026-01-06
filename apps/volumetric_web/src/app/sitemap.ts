import type { MetadataRoute } from "next";
import { getPathname, routing } from "@/i18n/routing";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://isometric.fi";

type Route = {
  pathname: "/" | "/buy" | "/write" | "/portfolio" | "/history";
  priority: number;
  changeFrequency: "daily";
};

const routes: Route[] = [
  { pathname: "/", priority: 1, changeFrequency: "daily" },
  { pathname: "/buy", priority: 0.9, changeFrequency: "daily" },
  { pathname: "/write", priority: 0.9, changeFrequency: "daily" },
  { pathname: "/portfolio", priority: 0.8, changeFrequency: "daily" },
  { pathname: "/history", priority: 0.7, changeFrequency: "daily" },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  return routes.flatMap((route) =>
    routing.locales.map((locale) => {
      const pathname = getPathname({ href: route.pathname, locale });
      return {
        url: `${BASE_URL}${pathname}`,
        lastModified: now,
        changeFrequency: route.changeFrequency,
        priority: route.priority,
        alternates: {
          languages: Object.fromEntries(
            routing.locales.map((l) => [
              l,
              `${BASE_URL}${getPathname({ href: route.pathname, locale: l })}`,
            ]),
          ),
        },
      };
    }),
  );
}
