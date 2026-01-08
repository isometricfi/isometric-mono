// Using middleware.ts instead of proxy.ts for Cloudflare compatibility (proxy support coming soon).
// OpenNext doesn't support Next.js 16 proxy yet: https://github.com/opennextjs/opennextjs-cloudflare/issues/972
import type { NextRequest } from "next/server";
import createIntlMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

const intlMiddleware = createIntlMiddleware(routing);

const isDev = process.env.NODE_ENV === "development";

// Dynamic Labs SDK uses multiple domains (need both root and wildcard)
const DYNAMIC_CSP_SOURCES = [
  "https://dynamic.xyz",
  "https://*.dynamic.xyz",
  "https://dynamicauth.com",
  "https://*.dynamicauth.com",
  "https://dynamic-static-assets.com",
  "https://*.dynamic-static-assets.com",
].join(" ");

function generateCspHeaders(nonce: string): string {
  // 'strict-dynamic' allows scripts loaded by nonced scripts to execute.
  // We use nonces to eliminate 'unsafe-inline' for script-src in production.
  const scriptSrc = isDev
    ? `'self' 'unsafe-inline' 'unsafe-eval' ${DYNAMIC_CSP_SOURCES}`
    : `'self' 'nonce-${nonce}' 'strict-dynamic' ${DYNAMIC_CSP_SOURCES}`;

  // 'unsafe-inline' is required for style-src due to Dynamic Labs SDK injecting inline styles
  const styleSrc = `'self' 'unsafe-inline' ${DYNAMIC_CSP_SOURCES}`;

  const cspDirectives = [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    `style-src ${styleSrc}`,
    `img-src 'self' blob: data: ${DYNAMIC_CSP_SOURCES}`,
    `font-src 'self' data: https://fonts.gstatic.com https://fonts.googleapis.com https://cdn.jsdelivr.net ${DYNAMIC_CSP_SOURCES}`,
    `connect-src 'self' ${DYNAMIC_CSP_SOURCES} wss://*.dynamic.xyz https://ic0.app https://api.coingecko.com`,
    `frame-src 'self' https://export.turnkey.com ${DYNAMIC_CSP_SOURCES}`,
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests",
  ];

  return cspDirectives.join("; ");
}

export function middleware(request: NextRequest) {
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
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  );

  return response;
}

export const config = {
  matcher: ["/", "/(zh|en)/:path*", "/((?!api|_next|_vercel|.*\\..*).*)"],
};
