// Using middleware.ts instead of proxy.ts for Cloudflare compatibility (proxy support coming soon).
// OpenNext doesn't support Next.js 16 proxy yet: https://github.com/opennextjs/opennextjs-cloudflare/issues/972
import { type NextRequest, NextResponse } from "next/server";
import createIntlMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

const intlMiddleware = createIntlMiddleware(routing);

const isDev = process.env.NODE_ENV === "development";

const APP_PATH_PREFIXES = ["/buy", "/write", "/portfolio", "/history", "/s"] as const;
const LANDING_PAGE_PATH_PREFIXES = ["/privacy", "/terms"] as const;
const LOCALE_PATH_PREFIXES = routing.locales.map((locale) => `/${locale}`);
const HOMEPAGE_PATH = "/";
const APP_DEFAULT_PATH = "/buy";

// Dynamic Labs SDK uses multiple domains (need both root and wildcard)
const DYNAMIC_CSP_SOURCES = [
  "https://dynamic.xyz",
  "https://*.dynamic.xyz",
  "https://dynamicauth.com",
  "https://*.dynamicauth.com",
  "https://dynamic-static-assets.com",
  "https://*.dynamic-static-assets.com",
].join(" ");

const TAWK_CSP_SOURCES = ["https://embed.tawk.to", "https://*.tawk.to"].join(" ");
const TAWK_CONNECT_CSP_SOURCES = [
  "https://embed.tawk.to",
  "https://*.tawk.to",
  "wss://*.tawk.to",
].join(" ");

function generateCspHeaders(nonce: string): string {
  // 'strict-dynamic' allows scripts loaded by nonced scripts to execute.
  // We use nonces to eliminate 'unsafe-inline' for script-src in production.
  const scriptSrc = isDev
    ? `'self' 'unsafe-inline' 'unsafe-eval' ${DYNAMIC_CSP_SOURCES} ${TAWK_CSP_SOURCES}`
    : `'self' 'nonce-${nonce}' 'strict-dynamic' ${DYNAMIC_CSP_SOURCES} ${TAWK_CSP_SOURCES}`;

  // 'unsafe-inline' is required for style-src due to Dynamic Labs SDK injecting inline styles
  const styleSrc = `'self' 'unsafe-inline' ${DYNAMIC_CSP_SOURCES} ${TAWK_CSP_SOURCES}`;

  const cspDirectives = [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    `style-src ${styleSrc}`,
    `img-src 'self' blob: data: https://cdn.jsdelivr.net ${DYNAMIC_CSP_SOURCES} ${TAWK_CSP_SOURCES}`,
    `font-src 'self' data: https://fonts.gstatic.com https://fonts.googleapis.com https://cdn.jsdelivr.net ${DYNAMIC_CSP_SOURCES} ${TAWK_CSP_SOURCES}`,
    `connect-src 'self' ${DYNAMIC_CSP_SOURCES} ${TAWK_CONNECT_CSP_SOURCES} https://mempool.space wss://mempool.space wss://*.dynamic.xyz https://ic0.app`,
    `frame-src 'self' https://export.turnkey.com ${DYNAMIC_CSP_SOURCES} ${TAWK_CSP_SOURCES}`,
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests",
  ];

  return cspDirectives.join("; ");
}

function stripLocalePrefix(pathname: string): string {
  for (const prefix of LOCALE_PATH_PREFIXES) {
    if (pathname === prefix) {
      return HOMEPAGE_PATH;
    }
    if (pathname.startsWith(`${prefix}/`)) {
      return pathname.slice(prefix.length);
    }
  }
  return pathname;
}

function matchesAnyPrefix(pathname: string, prefixes: readonly string[]): boolean {
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function isAppPath(pathname: string): boolean {
  return matchesAnyPrefix(stripLocalePrefix(pathname), APP_PATH_PREFIXES);
}

function isLandingPagePath(pathname: string): boolean {
  const stripped = stripLocalePrefix(pathname);
  if (stripped === HOMEPAGE_PATH) {
    return true;
  }
  return matchesAnyPrefix(stripped, LANDING_PAGE_PATH_PREFIXES);
}

function applyHostRouting(request: NextRequest): NextResponse | null {
  const appHost = process.env.NEXT_PUBLIC_APP_HOST;
  const landingPageHost = process.env.NEXT_PUBLIC_LANDING_PAGE_HOST;
  if (!appHost || !landingPageHost) {
    return null;
  }

  const requestHost = request.headers.get("host");
  if (!requestHost) {
    return null;
  }

  const pathname = request.nextUrl.pathname;
  const search = request.nextUrl.search;

  if (requestHost === landingPageHost && isAppPath(pathname)) {
    const target = new URL(`https://${appHost}${pathname}${search}`);
    return NextResponse.redirect(target, 308);
  }

  if (requestHost === appHost) {
    if (pathname === HOMEPAGE_PATH) {
      const target = new URL(`https://${appHost}${APP_DEFAULT_PATH}${search}`);
      return NextResponse.redirect(target, 302);
    }
    if (isLandingPagePath(pathname) && pathname !== HOMEPAGE_PATH) {
      const target = new URL(`https://${landingPageHost}${pathname}${search}`);
      return NextResponse.redirect(target, 308);
    }
  }

  return null;
}

export function middleware(request: NextRequest) {
  const hostRedirect = applyHostRouting(request);
  if (hostRedirect) {
    return hostRedirect;
  }

  // Generate a unique nonce for this request
  const nonce = crypto.randomUUID();

  // Run the intl middleware first
  const response = intlMiddleware(request);

  // Add nonce header for use in layout components via headers()
  response.headers.set("x-nonce", nonce);

  // Add security headers to the existing response
  // Only add CSP in production - dev mode has too many dynamic injections
  if (!isDev) {
    response.headers.set("Content-Security-Policy", generateCspHeaders(nonce));
  }

  // These headers are safe for both dev and prod
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  );

  return response;
}

export const config = {
  matcher: ["/", "/(zh|en)/:path*", "/((?!api|_next|_vercel|.*\\..*).*)"],
};
