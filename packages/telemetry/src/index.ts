import { ROOT_CONTEXT, type Span, SpanStatusCode, type Tracer, trace } from "@opentelemetry/api";
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-http";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { Resource } from "@opentelemetry/resources";
import { BatchLogRecordProcessor, LoggerProvider } from "@opentelemetry/sdk-logs";
import { BasicTracerProvider, BatchSpanProcessor } from "@opentelemetry/sdk-trace-base";

export interface TelemetryEnv {
  [key: string]: string | undefined;
  OTEL_SERVICE_NAME?: string;
  OTEL_EXPORTER_OTLP_TRACES_ENDPOINT?: string;
  OTEL_EXPORTER_OTLP_LOGS_ENDPOINT?: string;
  OTEL_EXPORTER_AUTH?: string;
}

export type LogLevel = "info" | "warn" | "error" | "debug";

const DEFAULT_TRACER_NAME = "volumetric";
const ATTR_SERVICE_NAME = "service.name";
const ATTR_SERVICE_INSTANCE_ID = "service.instance.id";

const OTEL_LOG_SEVERITY: Record<LogLevel, number> = {
  debug: 5,
  info: 9,
  warn: 13,
  error: 17,
};

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

let activeStandardSpan: Span | undefined;

interface StandardLogger {
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
  logger?: StandardLogger;
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
    standardTelemetryState.logger = loggerProvider.getLogger(
      telemetryState.serviceName,
    ) as StandardLogger;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn("Failed to initialize standard OTLP log exporter", { error: message });
  }
}

function setupStandardTelemetry(): void {
  setupStandardTraceExporter();
  setupStandardLogExporter();
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

function exportStandardLog(
  level: LogLevel,
  message: string,
  attributes: Record<string, string | number | boolean>,
): void {
  const logger = standardTelemetryState.logger;
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
    console.warn("Failed to emit standard OTLP log", { error: otelError });
  }
}

export function initTelemetry(serviceInstanceId: string, env?: TelemetryEnv): void {
  telemetryState.serviceName = env?.OTEL_SERVICE_NAME ?? DEFAULT_TRACER_NAME;
  telemetryState.serviceInstanceId = serviceInstanceId;
  telemetryState.tracesEndpoint = env?.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT;
  telemetryState.logsEndpoint = env?.OTEL_EXPORTER_OTLP_LOGS_ENDPOINT;
  telemetryState.authHeader = parseAuthorizationHeader(env?.OTEL_EXPORTER_AUTH);
  setupStandardTelemetry();

  console.info("Telemetry initialized", {
    serviceName: telemetryState.serviceName,
    serviceInstanceId: telemetryState.serviceInstanceId,
    mode: "standard",
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
  standardTelemetryState.logger = undefined;
  activeStandardSpan = undefined;
}

export function log(
  level: LogLevel,
  message: string,
  attributes?: Record<string, string | number | boolean>,
): void {
  const timestamp = new Date().toISOString();
  const prefix = `[${timestamp}] [${level.toUpperCase()}] [${telemetryState.serviceInstanceId}]`;
  const logAttributes = {
    [ATTR_SERVICE_INSTANCE_ID]: telemetryState.serviceInstanceId,
    ...(attributes ?? {}),
  };

  if (level === "error") {
    console.error(`${prefix} ${message}`, logAttributes);
  } else if (level === "warn") {
    console.warn(`${prefix} ${message}`, logAttributes);
  } else {
    console.log(`${prefix} ${message}`, logAttributes);
  }

  exportStandardLog(level, message, logAttributes);
}

type SpanAttributes = Record<string, string | number | boolean>;

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
    spanContext: () => ({
      traceId: "00000000000000000000000000000000",
      spanId: "0000000000000000",
      traceFlags: 0,
      isRemote: false,
    }),
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
