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

export interface TelemetryEnv {
  [key: string]: string | undefined;
  OTEL_SERVICE_NAME?: string;
  OTEL_EXPORTER_OTLP_TRACES_ENDPOINT?: string;
  OTEL_EXPORTER_OTLP_LOGS_ENDPOINT?: string;
  OTEL_EXPORTER_AUTH?: string;
}

export type LogLevel = "info" | "warn" | "error" | "debug";
export type { Logger } from "pino";

type SpanAttributes = Record<string, string | number | boolean>;
type AnyFunction = (...args: unknown[]) => unknown;
type AttributeResolver = (
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

export interface AppTelemetry {
  ensureInitialized: (explicitEnv?: TelemetryEnv) => void;
  logger: pino.Logger;
  withSpan: <T>(
    name: string,
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

const DEFAULT_TRACER_NAME = "volumetric";
const ATTR_SERVICE_NAME = "service.name";
const ATTR_SERVICE_INSTANCE_ID = "service.instance.id";

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
    console.warn("Failed to initialize standard OTLP trace exporter", { error: message });
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

function setupStandardTelemetry(): void {
  setupStandardTraceExporter();
  setupStandardLogExporter();
  setupPinoLogger();
}

function startStandardSpan(
  name: string,
  attributes: Record<string, string | number | boolean>,
): Span | undefined {
  const tracer = standardTelemetryState.tracer;
  if (!tracer) {
    return undefined;
  }

  const parentContext = activeStandardSpan
    ? trace.setSpan(ROOT_CONTEXT, activeStandardSpan)
    : ROOT_CONTEXT;
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

export function log(
  level: LogLevel,
  message: string,
  attributes?: Record<string, string | number | boolean>,
): void {
  const logAttributes = attributes ?? {};

  if (pinoLogger) {
    pinoLogger[level](logAttributes, message);
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

export async function withSpan<T>(
  name: string,
  attributes: SpanAttributes,
  fn: (span: Span) => Promise<T>,
): Promise<T> {
  const spanAttributes: SpanAttributes = { ...attributes };
  const previousStandardSpan = activeStandardSpan;
  const standardSpan = startStandardSpan(name, attributes);

  const spanShim = {
    setAttribute: (key: string, value: string | number | boolean) => {
      spanAttributes[key] = value;
      return spanShim;
    },
    setStatus: () => spanShim,
    addEvent: () => spanShim,
    addLink: () => spanShim,
    recordException: () => undefined,
    updateName: () => spanShim,
    end: () => undefined,
    isRecording: () => true,
    spanContext: () => INVALID_SPAN_CONTEXT,
  } as unknown as Span;

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
    if (standardSpan) {
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

export function createAppTelemetry(options: CreateAppTelemetryOptions): AppTelemetry {
  let telemetryInitialized = false;

  const defaultResolver = createProcessEnvResolver(options.serviceInstanceId);

  const resolveEnv = (explicitEnv?: TelemetryEnv): TelemetryEnv | undefined => {
    if (options.resolveEnv) {
      return options.resolveEnv(explicitEnv);
    }

    return defaultResolver(explicitEnv);
  };

  const buildMethodNamespace = (namespace: string): string => {
    if (!options.methodNamespacePrefix) {
      return namespace;
    }

    return `${options.methodNamespacePrefix}.${namespace}`;
  };

  const ensureInitialized = (explicitEnv?: TelemetryEnv): void => {
    if (telemetryInitialized) {
      return;
    }

    initTelemetry(options.serviceInstanceId, resolveEnv(explicitEnv));
    telemetryInitialized = true;
  };

  const runWithSpan = async <T>(
    name: string,
    attributes: SpanAttributes,
    fn: (span: Span) => Promise<T>,
  ): Promise<T> => {
    ensureInitialized();
    return withSpan(name, attributes, fn);
  };

  const emitLog = (
    level: LogLevel,
    message: string,
    attributes?: Record<string, string | number | boolean>,
  ): void => {
    ensureInitialized();
    log(level, message, attributes);
  };

  const wrapMethods = <T extends object>(
    namespace: string,
    target: T,
    wrappedOptions?: SpanWrappedMethodsOptions,
  ): T => {
    ensureInitialized();
    return withSpanWrappedMethods(buildMethodNamespace(namespace), target, wrappedOptions);
  };

  const getLogger = (): pino.Logger => {
    ensureInitialized();
    if (!pinoLogger) {
      return pino({ level: "debug" });
    }
    return pinoLogger;
  };

  return {
    ensureInitialized,
    get logger() {
      return getLogger();
    },
    withSpan: runWithSpan,
    log: emitLog,
    shutdown: shutdownTelemetry,
    withSpanWrappedMethods: wrapMethods,
  };
}
