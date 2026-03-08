import { type Attributes, type Span, SpanStatusCode, trace } from "@opentelemetry/api";

type EnvRecord = Record<string, unknown>;
type SpanCallback<T> = (span: Span) => Promise<T> | T;

export type EnvValue = string | undefined;

export interface WithSpan {
  <T>(name: string, fn: SpanCallback<T>): Promise<T>;
  <T>(name: string, attributes: Attributes, fn: SpanCallback<T>): Promise<T>;
}

export function createWithSpan(tracerName: string): WithSpan {
  const tracer = trace.getTracer(tracerName);

  async function withSpan<T>(
    name: string,
    attributesOrFn: Attributes | SpanCallback<T>,
    fn?: SpanCallback<T>,
  ): Promise<T> {
    const attributes = typeof attributesOrFn === "function" ? undefined : attributesOrFn;
    const spanCallback = typeof attributesOrFn === "function" ? attributesOrFn : fn;

    if (!spanCallback) {
      throw new Error("withSpan requires a callback");
    }

    return tracer.startActiveSpan(name, async (span) => {
      if (attributes) {
        span.setAttributes(attributes);
      }

      try {
        return await spanCallback(span);
      } catch (error) {
        const message = getErrorMessage(error);

        span.recordException(error instanceof Error ? error : new Error(message));
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message,
        });

        throw error;
      } finally {
        span.end();
      }
    });
  }

  return withSpan;
}

export function createOtlpTraceConfig(env: EnvRecord, defaultServiceName: string) {
  return {
    exporter: {
      url: getRequiredEnv(env, "OTEL_EXPORTER_OTLP_TRACES_ENDPOINT"),
      headers: parseOtlpHeaders(getOptionalEnv(env, "OTEL_EXPORTER_OTLP_HEADERS")),
    },
    service: {
      name: getOptionalEnv(env, "OTEL_SERVICE_NAME") ?? defaultServiceName,
    },
  };
}

export function getOptionalEnv(env: EnvRecord, key: string): EnvValue {
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

export function getRequiredEnv(env: EnvRecord, key: string): string {
  const value = getOptionalEnv(env, key);

  if (!value) {
    throw new Error(`${key} environment variable is required for tracing`);
  }

  return value;
}

export function parseOtlpHeaders(rawHeaders: EnvValue): Record<string, string> | undefined {
  if (!rawHeaders) {
    return undefined;
  }

  const decodedHeaders = decodeHeaderValue(rawHeaders.trim());

  if (!decodedHeaders.length) {
    return undefined;
  }

  const parsedHeaders = Object.fromEntries(
    decodedHeaders
      .split(",")
      .map((header) => header.trim())
      .filter(Boolean)
      .map((header) => {
        const separatorIndex = header.indexOf("=");

        if (separatorIndex <= 0) {
          return undefined;
        }

        const key = header.slice(0, separatorIndex).trim();
        const value = header.slice(separatorIndex + 1).trim();

        if (!key || !value) {
          return undefined;
        }

        return [key, value] as const;
      })
      .filter((header): header is readonly [string, string] => header !== undefined),
  );

  if (Object.keys(parsedHeaders).length === 0) {
    return undefined;
  }

  return parsedHeaders;
}

function decodeHeaderValue(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}
