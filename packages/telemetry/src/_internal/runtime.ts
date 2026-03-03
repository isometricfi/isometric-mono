import {
  INVALID_SPAN_CONTEXT,
  ROOT_CONTEXT,
  type Span,
  SpanStatusCode,
  type Tracer,
  trace,
} from "@opentelemetry/api";
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-http";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { Resource } from "@opentelemetry/resources";
import { BatchLogRecordProcessor, LoggerProvider } from "@opentelemetry/sdk-logs";
import { BasicTracerProvider, BatchSpanProcessor } from "@opentelemetry/sdk-trace-base";
import pino from "pino";
import type {
  AnyFunction,
  LogLevel,
  SpanAttributes,
  SpanWrappedMethodsOptions,
  TelemetryEnv,
} from "../types";

const DEFAULT_TRACER_NAME = "volumetric";
const ATTR_SERVICE_NAME = "service.name";
const ATTR_SERVICE_INSTANCE_ID = "service.instance.id";
const TRACEPARENT_HEADER = "traceparent";
const TRACEPARENT_VERSION = "00";
const TRACEPARENT_REGEX = /^00-([0-9a-f]{32})-([0-9a-f]{16})-([0-9a-f]{2})$/;

interface TelemetryState {
  serviceName: string;
  serviceInstanceId: string;
  tracesEndpoint?: string;
  logsEndpoint?: string;
  authHeader?: string;
}

const telemetryState: TelemetryState = {
  serviceName: DEFAULT_TRACER_NAME,
  serviceInstanceId: "unknown",
};

const OTEL_LOG_SEVERITY: Record<LogLevel, number> = {
  debug: 5,
  info: 9,
  warn: 13,
  error: 17,
};

let activeStandardSpan: Span | undefined;
let pinoLogger: pino.Logger | undefined;

interface OtlpLogger {
  emit: (record: {
    severityNumber: number;
    severityText: string;
    body: string;
    attributes: Record<string, string | number | boolean>;
  }) => void;
}

interface StandardTelemetryState {
  tracerProvider?: BasicTracerProvider;
  tracer?: Tracer;
  loggerProvider?: LoggerProvider;
  otlpLogger?: OtlpLogger;
}

const standardTelemetryState: StandardTelemetryState = {};

export function createProcessEnvResolver(
  defaultServiceName: string,
): (explicitEnv?: TelemetryEnv) => TelemetryEnv | undefined {
  return (explicitEnv?: TelemetryEnv): TelemetryEnv | undefined => {
    if (explicitEnv) {
      return explicitEnv;
    }

    if (typeof process !== "undefined") {
      return {
        ...process.env,
        OTEL_SERVICE_NAME: process.env.OTEL_SERVICE_NAME ?? defaultServiceName,
      };
    }

    return undefined;
  };
}

function parseAuthorizationHeader(rawAuth?: string): string | undefined {
  if (!rawAuth) {
    return undefined;
  }

  const decoded = decodeHeaderToken(rawAuth.trim());
  if (!decoded.length) {
    return undefined;
  }

  if (decoded.startsWith("Authorization=")) {
    return decoded.slice("Authorization=".length).trim();
  }

  return decoded;
}

function decodeHeaderToken(token: string): string {
  try {
    return decodeURIComponent(token);
  } catch {
    return token;
  }
}

function buildExporterHeaders(): Record<string, string> {
  if (!telemetryState.authHeader) {
    return {};
  }

  return {
    Authorization: telemetryState.authHeader,
  };
}

function buildTelemetryResource() {
  return new Resource({
    [ATTR_SERVICE_NAME]: telemetryState.serviceName,
    [ATTR_SERVICE_INSTANCE_ID]: telemetryState.serviceInstanceId,
  });
}

function setupStandardTraceExporter(): void {
  if (!telemetryState.tracesEndpoint) {
    return;
  }

  try {
    const traceExporter = new OTLPTraceExporter({
      url: telemetryState.tracesEndpoint,
      headers: buildExporterHeaders(),
      concurrencyLimit: 5,
    });
    const resource = buildTelemetryResource();
    const tracerProvider = new BasicTracerProvider({
      resource,
      spanProcessors: [
        new BatchSpanProcessor(traceExporter, {
          maxQueueSize: 2048,
          maxExportBatchSize: 256,
          scheduledDelayMillis: 1000,
          exportTimeoutMillis: 10000,
        }),
      ],
    });
    standardTelemetryState.tracerProvider = tracerProvider;
    standardTelemetryState.tracer = tracerProvider.getTracer(telemetryState.serviceName);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn("Failed to initialize standard OTLP trace exporter", {
      error: message,
    });
  }
}

function setupStandardLogExporter(): void {
  if (!telemetryState.logsEndpoint) {
    return;
  }

  try {
    const logExporter = new OTLPLogExporter({
      url: telemetryState.logsEndpoint,
      headers: buildExporterHeaders(),
      concurrencyLimit: 5,
    });
    const resource = buildTelemetryResource();
    const loggerProvider = new LoggerProvider({ resource });
    loggerProvider.addLogRecordProcessor(new BatchLogRecordProcessor(logExporter));
    standardTelemetryState.loggerProvider = loggerProvider;
    standardTelemetryState.otlpLogger = loggerProvider.getLogger(
      telemetryState.serviceName,
    ) as OtlpLogger;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn("Failed to initialize standard OTLP log exporter", {
      error: message,
    });
  }
}

function setupPinoLogger(): void {
  pinoLogger = pino({
    level: "debug",
    base: {
      [ATTR_SERVICE_NAME]: telemetryState.serviceName,
      [ATTR_SERVICE_INSTANCE_ID]: telemetryState.serviceInstanceId,
    },
  });
}

function setupStandardTelemetry(): void {
  setupStandardTraceExporter();
  setupStandardLogExporter();
  setupPinoLogger();
}

function exportOtlpLog(
  level: LogLevel,
  message: string,
  attributes: Record<string, string | number | boolean>,
): void {
  const logger = standardTelemetryState.otlpLogger;
  if (!logger) {
    return;
  }

  try {
    logger.emit({
      severityNumber: OTEL_LOG_SEVERITY[level],
      severityText: level.toUpperCase(),
      body: message,
      attributes: {
        [ATTR_SERVICE_NAME]: telemetryState.serviceName,
        [ATTR_SERVICE_INSTANCE_ID]: telemetryState.serviceInstanceId,
        ...attributes,
      },
    });
  } catch (error) {
    const otelError = error instanceof Error ? error.message : String(error);
    console.warn("Failed to emit OTLP log", { error: otelError });
  }
}

function parseTraceparent(
  header: string,
): { traceId: string; spanId: string; traceFlags: number } | undefined {
  const match = TRACEPARENT_REGEX.exec(header.trim());
  if (!match) {
    return undefined;
  }

  return {
    traceId: match[1],
    spanId: match[2],
    traceFlags: Number.parseInt(match[3], 16),
  };
}

function buildRemoteParentContext(
  headers: Record<string, string | undefined>,
): typeof ROOT_CONTEXT {
  const traceparent = headers[TRACEPARENT_HEADER];
  if (!traceparent) {
    return ROOT_CONTEXT;
  }

  const parsed = parseTraceparent(traceparent);
  if (!parsed) {
    return ROOT_CONTEXT;
  }

  const remoteSpanContext = {
    traceId: parsed.traceId,
    spanId: parsed.spanId,
    traceFlags: parsed.traceFlags,
    isRemote: true,
  };

  return trace.setSpanContext(ROOT_CONTEXT, remoteSpanContext);
}

function startStandardSpan(
  name: string,
  attributes: SpanAttributes,
  parentContext: typeof ROOT_CONTEXT = activeStandardSpan
    ? trace.setSpan(ROOT_CONTEXT, activeStandardSpan)
    : ROOT_CONTEXT,
): Span | undefined {
  const tracer = standardTelemetryState.tracer;
  if (!tracer) {
    return undefined;
  }

  return tracer.startSpan(
    name,
    {
      attributes: {
        ...attributes,
        [ATTR_SERVICE_NAME]: telemetryState.serviceName,
        [ATTR_SERVICE_INSTANCE_ID]: telemetryState.serviceInstanceId,
      },
    },
    parentContext,
  );
}

function applyStandardSpanAttributes(
  span: Span,
  attributes: Record<string, string | number | boolean>,
): void {
  for (const [key, value] of Object.entries(attributes)) {
    span.setAttribute(key, value);
  }
}

function createSpanShim(
  spanAttributes: SpanAttributes,
  standardSpan?: Span,
  onEnd?: () => void,
): Span {
  let spanEnded = false;

  const spanShim = {
    setAttribute: (key: string, value: string | number | boolean) => {
      spanAttributes[key] = value;
      standardSpan?.setAttribute(key, value);
      return spanShim;
    },
    setStatus: (...args: Parameters<Span["setStatus"]>) => {
      standardSpan?.setStatus(...args);
      return spanShim;
    },
    addEvent: (...args: Parameters<Span["addEvent"]>) => {
      standardSpan?.addEvent(...args);
      return spanShim;
    },
    addLink: (...args: Parameters<Span["addLink"]>) => {
      standardSpan?.addLink(...args);
      return spanShim;
    },
    recordException: (...args: Parameters<Span["recordException"]>) => {
      standardSpan?.recordException(...args);
    },
    updateName: (...args: Parameters<Span["updateName"]>) => {
      standardSpan?.updateName(...args);
      return spanShim;
    },
    end: (...args: Parameters<Span["end"]>) => {
      if (spanEnded) {
        return;
      }
      spanEnded = true;
      standardSpan?.end(...args);
      onEnd?.();
    },
    isRecording: () => standardSpan?.isRecording() ?? true,
    spanContext: () => standardSpan?.spanContext() ?? INVALID_SPAN_CONTEXT,
  } as unknown as Span;

  return spanShim;
}

export function initTelemetry(serviceInstanceId: string, env?: TelemetryEnv): void {
  telemetryState.serviceName = env?.OTEL_SERVICE_NAME ?? DEFAULT_TRACER_NAME;
  telemetryState.serviceInstanceId = serviceInstanceId;
  telemetryState.tracesEndpoint = env?.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT;
  telemetryState.logsEndpoint = env?.OTEL_EXPORTER_OTLP_LOGS_ENDPOINT;
  telemetryState.authHeader = parseAuthorizationHeader(env?.OTEL_EXPORTER_AUTH);
  setupStandardTelemetry();

  log("info", "Telemetry initialized", {
    hasTracesEndpoint: Boolean(telemetryState.tracesEndpoint),
    hasLogsEndpoint: Boolean(telemetryState.logsEndpoint),
  });
}

export async function shutdownTelemetry(): Promise<void> {
  const pendingShutdowns: Array<Promise<unknown>> = [];

  if (standardTelemetryState.tracerProvider) {
    pendingShutdowns.push(
      standardTelemetryState.tracerProvider
        .forceFlush()
        .catch(() => undefined)
        .then(() => standardTelemetryState.tracerProvider?.shutdown().catch(() => undefined)),
    );
  }

  if (standardTelemetryState.loggerProvider) {
    pendingShutdowns.push(
      standardTelemetryState.loggerProvider
        .forceFlush()
        .catch(() => undefined)
        .then(() => standardTelemetryState.loggerProvider?.shutdown().catch(() => undefined)),
    );
  }

  if (pendingShutdowns.length > 0) {
    await Promise.all(pendingShutdowns);
  }

  standardTelemetryState.tracerProvider = undefined;
  standardTelemetryState.tracer = undefined;
  standardTelemetryState.loggerProvider = undefined;
  standardTelemetryState.otlpLogger = undefined;
  pinoLogger = undefined;
  activeStandardSpan = undefined;
}

export function getLogger(): pino.Logger {
  if (!pinoLogger) {
    return pino({ level: "debug" });
  }

  return pinoLogger;
}

export function log(
  level: LogLevel,
  message: string,
  attributes?: Record<string, string | number | boolean>,
): void {
  const logAttributes = attributes ?? {};
  const logger = pinoLogger;

  if (logger) {
    logger[level](logAttributes, message);
  } else {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level.toUpperCase()}] [${telemetryState.serviceInstanceId}]`;
    if (level === "error") {
      console.error(`${prefix} ${message}`, logAttributes);
    } else if (level === "warn") {
      console.warn(`${prefix} ${message}`, logAttributes);
    } else {
      console.log(`${prefix} ${message}`, logAttributes);
    }
  }

  exportOtlpLog(level, message, logAttributes);
}

export function getTraceHeaders(): Record<string, string> {
  const span = activeStandardSpan;
  if (!span) {
    return {};
  }

  const spanContext = span.spanContext();
  if (!spanContext.traceId || !spanContext.spanId) {
    return {};
  }

  const flags = (spanContext.traceFlags ?? 0).toString(16).padStart(2, "0");
  return {
    [TRACEPARENT_HEADER]: `${TRACEPARENT_VERSION}-${spanContext.traceId}-${spanContext.spanId}-${flags}`,
  };
}

export async function withSpan<T>(
  name: string,
  attributes: SpanAttributes,
  fn: (span: Span) => Promise<T>,
): Promise<T> {
  const spanAttributes: SpanAttributes = { ...attributes };
  const previousStandardSpan = activeStandardSpan;
  const standardSpan = startStandardSpan(name, attributes);
  let spanEnded = false;
  const spanShim = createSpanShim(spanAttributes, standardSpan, () => {
    spanEnded = true;
  });

  if (standardSpan) {
    activeStandardSpan = standardSpan;
  }

  try {
    const result = await fn(spanShim);
    if (standardSpan) {
      applyStandardSpanAttributes(standardSpan, spanAttributes);
      standardSpan.setStatus({
        code: SpanStatusCode.OK,
      });
    }

    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    spanAttributes["error.message"] = message;
    if (standardSpan) {
      applyStandardSpanAttributes(standardSpan, spanAttributes);
      standardSpan.recordException(error as Error);
      standardSpan.setStatus({
        code: SpanStatusCode.ERROR,
        message,
      });
    }

    throw error;
  } finally {
    if (standardSpan && !spanEnded) {
      standardSpan.end();
    }

    activeStandardSpan = previousStandardSpan;
  }
}

export async function withRemoteParentSpan<T>(
  name: string,
  headers: Record<string, string | undefined>,
  attributes: SpanAttributes,
  fn: (span: Span) => Promise<T>,
): Promise<T> {
  const parentContext = buildRemoteParentContext(headers);
  const previousStandardSpan = activeStandardSpan;
  const standardSpan = startStandardSpan(name, attributes, parentContext);
  const spanAttributes: SpanAttributes = { ...attributes };
  let spanEnded = false;
  const spanShim = createSpanShim(spanAttributes, standardSpan, () => {
    spanEnded = true;
  });

  if (standardSpan) {
    activeStandardSpan = standardSpan;
  }

  try {
    const result = await fn(spanShim);
    if (standardSpan) {
      standardSpan.setStatus({ code: SpanStatusCode.OK });
    }
    return result;
  } catch (error) {
    if (standardSpan) {
      const message = error instanceof Error ? error.message : String(error);
      standardSpan.recordException(error as Error);
      standardSpan.setStatus({ code: SpanStatusCode.ERROR, message });
    }
    throw error;
  } finally {
    if (standardSpan && !spanEnded) {
      standardSpan.end();
    }
    activeStandardSpan = previousStandardSpan;
  }
}

function isPromiseLike(value: unknown): value is Promise<unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    "then" in value &&
    typeof (value as { then?: unknown }).then === "function"
  );
}

export function withSpanWrappedMethods<T extends object>(
  namespace: string,
  target: T,
  options?: SpanWrappedMethodsOptions,
): T {
  const wrappedMethods = new Map<PropertyKey, AnyFunction>();

  return new Proxy(target, {
    get(source, property, receiver) {
      const value = Reflect.get(source, property, receiver);
      if (typeof value !== "function") {
        return value;
      }

      if (wrappedMethods.has(property)) {
        return wrappedMethods.get(property);
      }

      const wrappedMethod: AnyFunction = (...args: unknown[]) => {
        const dynamicAttributes = options?.getAttributes?.(args, property) ?? {};
        const spanAttributes: SpanAttributes = {
          arg_count: args.length,
          ...dynamicAttributes,
        };
        const spanName = `${namespace}.${String(property)}`;
        options?.onSpanStart?.(spanName, spanAttributes);
        const previousStandardSpan = activeStandardSpan;
        const standardSpan = startStandardSpan(spanName, spanAttributes);

        if (standardSpan) {
          activeStandardSpan = standardSpan;
        }

        const finalizeSuccess = (result: unknown) => {
          if (standardSpan) {
            applyStandardSpanAttributes(standardSpan, spanAttributes);
            standardSpan.setStatus({
              code: SpanStatusCode.OK,
            });
          }
          return result;
        };

        const finalizeError = (error: unknown) => {
          const message = error instanceof Error ? error.message : String(error);
          spanAttributes["error.message"] = message;

          if (standardSpan) {
            applyStandardSpanAttributes(standardSpan, spanAttributes);
            standardSpan.recordException(error instanceof Error ? error : new Error(message));
            standardSpan.setStatus({
              code: SpanStatusCode.ERROR,
              message,
            });
          }
        };

        const cleanup = () => {
          if (standardSpan) {
            standardSpan.end();
          }
          activeStandardSpan = previousStandardSpan;
        };

        try {
          const result = (value as (...methodArgs: unknown[]) => unknown).apply(source, args);

          if (isPromiseLike(result)) {
            return result
              .then((resolved) => finalizeSuccess(resolved))
              .catch((error) => {
                finalizeError(error);
                throw error;
              })
              .finally(cleanup);
          }

          const resolved = finalizeSuccess(result);
          cleanup();
          return resolved;
        } catch (error) {
          finalizeError(error);
          cleanup();
          throw error;
        }
      };

      wrappedMethods.set(property, wrappedMethod);
      return wrappedMethod;
    },
  });
}
