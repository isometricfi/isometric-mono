import { instrument, type ResolveConfigFn } from "@microlabs/otel-cf-workers";
// biome-ignore lint/suspicious/noTsIgnore: OpenNext generates this file during the Cloudflare build.
// @ts-ignore OpenNext generates this file during the Cloudflare build.
import generatedWorker from "./.open-next/worker.js";

type EnvValue = string | undefined;

interface CloudflareEnv extends Record<string, unknown> {
  OTEL_EXPORTER_AUTH?: string;
  OTEL_EXPORTER_OTLP_TRACES_ENDPOINT?: string;
  OTEL_SERVICE_NAME?: string;
}

const DEFAULT_SERVICE_NAME = "volumetric-web";

const resolveTraceConfig: ResolveConfigFn<CloudflareEnv> = (env) => ({
  exporter: {
    url: getRequiredEnv(env, "OTEL_EXPORTER_OTLP_TRACES_ENDPOINT"),
    headers: parseExporterHeaders(getOptionalEnv(env, "OTEL_EXPORTER_AUTH")),
  },
  service: {
    name: getOptionalEnv(env, "OTEL_SERVICE_NAME") ?? DEFAULT_SERVICE_NAME,
  },
});

const worker = instrument(
  {
    fetch: generatedWorker.fetch,
  },
  resolveTraceConfig,
);

export default worker;

// biome-ignore lint/suspicious/noTsIgnore: OpenNext generates this file during the Cloudflare build.
// @ts-ignore OpenNext generates this file during the Cloudflare build.
export * from "./.open-next/worker.js";

function getRequiredEnv(env: CloudflareEnv, key: keyof CloudflareEnv): string {
  const value = getOptionalEnv(env, key);

  if (!value) {
    throw new Error(`${key} environment variable is required for tracing`);
  }

  return value;
}

function getOptionalEnv(env: CloudflareEnv, key: keyof CloudflareEnv): EnvValue {
  const bindingValue = env[key];

  if (typeof bindingValue === "string") {
    const trimmedBindingValue = bindingValue.trim();

    if (trimmedBindingValue) {
      return trimmedBindingValue;
    }
  }

  const processValue = process.env[key];

  if (!processValue) {
    return undefined;
  }

  const trimmedProcessValue = processValue.trim();
  return trimmedProcessValue || undefined;
}

function parseExporterHeaders(rawHeaders: EnvValue): Record<string, string> | undefined {
  if (!rawHeaders) {
    return undefined;
  }

  const decoded = decodeHeaderValue(rawHeaders.trim());

  if (!decoded.length) {
    return undefined;
  }

  if (decoded.startsWith("Authorization=")) {
    return {
      Authorization: decoded.slice("Authorization=".length).trim(),
    };
  }

  return {
    Authorization: decoded,
  };
}

function decodeHeaderValue(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
