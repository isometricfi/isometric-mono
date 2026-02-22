import { type Span, SpanStatusCode, type Tracer, trace } from "@opentelemetry/api";
import { type Logger, logs, SeverityNumber } from "@opentelemetry/api-logs";
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-http";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { Resource } from "@opentelemetry/resources";
import { BatchLogRecordProcessor } from "@opentelemetry/sdk-logs";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { BatchSpanProcessor, ConsoleSpanExporter } from "@opentelemetry/sdk-trace-base";
import { ATTR_SERVICE_NAME } from "@opentelemetry/semantic-conventions";

let sdk: NodeSDK | null = null;
let isOtelLogsEnabled = false;

const BOT_TRACER_NAME = "volumetric-bot";
const ATTR_SERVICE_INSTANCE_ID = "service.instance.id";

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

export function initTelemetry(botName: string): void {
  const tracesEndpoint = process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT;
  const logsEndpoint = process.env.OTEL_EXPORTER_OTLP_LOGS_ENDPOINT;
  const authorizationHeader = parseAuthorizationHeader(process.env.OTEL_EXPORTER_AUTH);
  const headers = authorizationHeader ? { Authorization: authorizationHeader } : undefined;

  isOtelLogsEnabled = Boolean(logsEndpoint);
  const serviceName = process.env.OTEL_SERVICE_NAME ?? BOT_TRACER_NAME;

  const resource = new Resource({
    [ATTR_SERVICE_NAME]: serviceName,
    [ATTR_SERVICE_INSTANCE_ID]: botName,
  });

  const spanProcessor = tracesEndpoint
    ? new BatchSpanProcessor(new OTLPTraceExporter({ url: tracesEndpoint, headers }))
    : new BatchSpanProcessor(new ConsoleSpanExporter());

  sdk = new NodeSDK({
    resource,
    spanProcessors: [spanProcessor],
    logRecordProcessors: logsEndpoint
      ? [new BatchLogRecordProcessor(new OTLPLogExporter({ url: logsEndpoint, headers }))]
      : [],
  });

  sdk.start();
}

export async function shutdownTelemetry(): Promise<void> {
  if (sdk) {
    try {
      await sdk.shutdown();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn("Telemetry shutdown error", { error: message });
    }
  }
}

export function getTracer(): Tracer {
  return trace.getTracer(BOT_TRACER_NAME);
}

function getOtelLogger(): Logger | null {
  if (!isOtelLogsEnabled) return null;
  return logs.getLogger(BOT_TRACER_NAME);
}

type LogLevel = "info" | "warn" | "error" | "debug";

const SEVERITY_MAP: Record<LogLevel, SeverityNumber> = {
  debug: SeverityNumber.DEBUG,
  info: SeverityNumber.INFO,
  warn: SeverityNumber.WARN,
  error: SeverityNumber.ERROR,
};

export function log(
  level: LogLevel,
  message: string,
  attributes?: Record<string, string | number | boolean>,
): void {
  const timestamp = new Date().toISOString();
  const prefix = `[${timestamp}] [${level.toUpperCase()}]`;

  if (level === "error") {
    console.error(`${prefix} ${message}`, attributes ?? "");
  } else if (level === "warn") {
    console.warn(`${prefix} ${message}`, attributes ?? "");
  } else {
    console.log(`${prefix} ${message}`, attributes ?? "");
  }

  const otelLogger = getOtelLogger();
  if (otelLogger) {
    otelLogger.emit({
      severityNumber: SEVERITY_MAP[level],
      severityText: level.toUpperCase(),
      body: message,
      attributes: attributes ?? {},
    });
  }
}

export async function withSpan<T>(
  name: string,
  attributes: Record<string, string | number | boolean>,
  fn: (span: Span) => Promise<T>,
): Promise<T> {
  const tracer = getTracer();
  return tracer.startActiveSpan(name, { attributes }, async (span) => {
    try {
      const result = await fn(span);
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : String(error),
      });
      span.recordException(error instanceof Error ? error : new Error(String(error)));
      throw error;
    } finally {
      span.end();
    }
  });
}
