import { type Span, SpanStatusCode, type Tracer, trace } from "@opentelemetry/api";
import { type Logger, logs, SeverityNumber } from "@opentelemetry/api-logs";
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-http";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { Resource } from "@opentelemetry/resources";
import { BatchLogRecordProcessor, LoggerProvider } from "@opentelemetry/sdk-logs";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { BatchSpanProcessor, ConsoleSpanExporter } from "@opentelemetry/sdk-trace-base";
import {
  SEMRESATTRS_SERVICE_INSTANCE_ID,
  SEMRESATTRS_SERVICE_NAME,
} from "@opentelemetry/semantic-conventions";

let sdk: NodeSDK | null = null;
let loggerProvider: LoggerProvider | null = null;

const BOT_TRACER_NAME = "volumetric-bot";

export function initTelemetry(botName: string): void {
  const otlpEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;

  const resource = new Resource({
    [SEMRESATTRS_SERVICE_NAME]: "volumetric-bot",
    [SEMRESATTRS_SERVICE_INSTANCE_ID]: botName,
  });

  const spanProcessor = otlpEndpoint
    ? new BatchSpanProcessor(new OTLPTraceExporter({ url: `${otlpEndpoint}/v1/traces` }))
    : new BatchSpanProcessor(new ConsoleSpanExporter());

  sdk = new NodeSDK({
    resource,
    spanProcessors: [spanProcessor],
  });

  sdk.start();

  if (otlpEndpoint) {
    loggerProvider = new LoggerProvider({ resource });
    loggerProvider.addLogRecordProcessor(
      new BatchLogRecordProcessor(new OTLPLogExporter({ url: `${otlpEndpoint}/v1/logs` })),
    );
    logs.setGlobalLoggerProvider(loggerProvider);
  }
}

export async function shutdownTelemetry(): Promise<void> {
  if (loggerProvider) {
    await loggerProvider.shutdown();
  }
  if (sdk) {
    await sdk.shutdown();
  }
}

export function getTracer(): Tracer {
  return trace.getTracer(BOT_TRACER_NAME);
}

function getOtelLogger(): Logger | null {
  if (!loggerProvider) return null;
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
