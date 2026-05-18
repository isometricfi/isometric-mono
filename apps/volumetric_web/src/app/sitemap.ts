import type { MetadataRoute } from "next";
import { getPathname, routing } from "@/i18n/routing";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://isometric.fi";

type Route = {
  pathname: "/" | "/privacy" | "/terms";
  priority: number;
  changeFrequency: "daily" | "monthly";
};

const routes: Route[] = [
  { pathname: "/", priority: 1, changeFrequency: "daily" },
  { pathname: "/privacy", priority: 0.3, changeFrequency: "monthly" },
  { pathname: "/terms", priority: 0.3, changeFrequency: "monthly" },
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
          languages: {
            ...Object.fromEntries(
              routing.locales.map((locale) => [
                locale,
                `${BASE_URL}${getPathname({ href: route.pathname, locale })}`,
              ]),
            ),
            "x-default": `${BASE_URL}${getPathname({ href: route.pathname, locale: routing.defaultLocale })}`,
          },
        },
      };
    }),
  );
}
