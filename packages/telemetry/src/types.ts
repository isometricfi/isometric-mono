import type { Span } from "@opentelemetry/api";
import type pino from "pino";

export interface TelemetryEnv {
  [key: string]: string | undefined;
  OTEL_SERVICE_NAME?: string;
  OTEL_EXPORTER_OTLP_TRACES_ENDPOINT?: string;
  OTEL_EXPORTER_OTLP_LOGS_ENDPOINT?: string;
  OTEL_EXPORTER_AUTH?: string;
}

export type LogLevel = "info" | "warn" | "error" | "debug";
export type SpanAttributes = Record<string, string | number | boolean>;
export type AnyFunction = (...args: unknown[]) => unknown;
export type AttributeResolver = (
  args: unknown[],
  property: PropertyKey,
) => Record<string, string | number | boolean>;

export interface SpanWrappedMethodsOptions {
  getAttributes?: AttributeResolver;
  onSpanStart?: (name: string, attributes: Record<string, string | number | boolean>) => void;
}

export interface CreateAppTelemetryOptions {
  serviceInstanceId: string;
  resolveEnv?: (explicitEnv?: TelemetryEnv) => TelemetryEnv | undefined;
  methodNamespacePrefix?: string;
}

export interface AppTelemetry {
  ensureInitialized: (explicitEnv?: TelemetryEnv) => void;
  logger: pino.Logger;
  getTraceHeaders: () => Record<string, string>;
  withSpan: <T>(
    name: string,
    attributes: SpanAttributes,
    fn: (span: Span) => Promise<T>,
  ) => Promise<T>;
  withRemoteParentSpan: <T>(
    name: string,
    headers: Record<string, string | undefined>,
    attributes: SpanAttributes,
    fn: (span: Span) => Promise<T>,
  ) => Promise<T>;
  log: (
    level: LogLevel,
    message: string,
    attributes?: Record<string, string | number | boolean>,
  ) => void;
  shutdown: () => Promise<void>;
  withSpanWrappedMethods: <T extends object>(
    namespace: string,
    target: T,
    options?: SpanWrappedMethodsOptions,
  ) => T;
}
