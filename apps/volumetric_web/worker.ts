import type { ExecutionContext } from "@cloudflare/workers-types";
import { instrument, type ResolveConfigFn } from "@microlabs/otel-cf-workers";
import { trace } from "@opentelemetry/api";
import { createOtlpTraceConfig } from "@volumetric/telemetry";
// biome-ignore lint/suspicious/noTsIgnore: OpenNext generates this file during the Cloudflare build.
// @ts-ignore OpenNext generates this file during the Cloudflare build.
import generatedWorker from "./.open-next/worker.js";

// :)

interface CloudflareEnv extends Record<string, unknown> {
  OTEL_EXPORTER_OTLP_HEADERS?: string;
  OTEL_EXPORTER_OTLP_TRACES_ENDPOINT?: string;
  OTEL_SERVICE_NAME?: string;
}

const DEFAULT_SERVICE_NAME = "volumetric-web";
const TRPC_PATH_PREFIX = "/api/trpc/";
const ROOT_PATHNAME = "/";
const PATHNAME_SEPARATOR = "/";
const DYNAMIC_PATH_SEGMENT = ":id";

const resolveTraceConfig: ResolveConfigFn<CloudflareEnv> = (env) =>
  createOtlpTraceConfig(env, DEFAULT_SERVICE_NAME);

const worker = instrument(
  {
    fetch(request: Request, env: CloudflareEnv, ctx: ExecutionContext) {
      updateRootSpanName(request);
      return generatedWorker.fetch(request, env, ctx);
    },
  },
  resolveTraceConfig,
);

export default worker;

// biome-ignore lint/suspicious/noTsIgnore: OpenNext generates this file during the Cloudflare build.
// @ts-ignore OpenNext generates this file during the Cloudflare build.
export * from "./.open-next/worker.js";

function updateRootSpanName(request: Request): void {
  const rootSpan = trace.getActiveSpan();

  if (!rootSpan) {
    return;
  }

  rootSpan.updateName(getRootSpanName(request));
}

function getRootSpanName(request: Request): string {
  const url = new URL(request.url);
  return `${request.method} ${normalizePathname(url.pathname)}`;
}

function normalizePathname(pathname: string): string {
  if (pathname === ROOT_PATHNAME) {
    return pathname;
  }

  if (pathname.startsWith(TRPC_PATH_PREFIX)) {
    return pathname;
  }

  const normalizedSegments = pathname
    .split(PATHNAME_SEPARATOR)
    .filter(Boolean)
    .map((segment) => (isDynamicSegment(segment) ? DYNAMIC_PATH_SEGMENT : segment));

  return `${PATHNAME_SEPARATOR}${normalizedSegments.join(PATHNAME_SEPARATOR)}`;
}

function isDynamicSegment(segment: string): boolean {
  return isNumericSegment(segment) || isUuidSegment(segment) || isLongIdentifierSegment(segment);
}

function isNumericSegment(segment: string): boolean {
  return /^\d+$/.test(segment);
}

function isUuidSegment(segment: string): boolean {
  return /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i.test(segment);
}

function isLongIdentifierSegment(segment: string): boolean {
  return segment.length >= 16 && /^[A-Za-z0-9_-]+$/.test(segment);
}
