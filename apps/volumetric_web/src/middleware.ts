// Using middleware.ts instead of proxy.ts for Cloudflare compatibility (proxy support coming soon).
// OpenNext doesn't support Next.js 16 proxy yet: https://github.com/opennextjs/opennextjs-cloudflare/issues/972
import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

export default createMiddleware(routing);

export const config = {
  matcher: ["/", "/(zh|en)/:path*", "/((?!api|_next|_vercel|.*\\..*).*)"],
};
