import { trace } from "@opentelemetry/api";
import { createWithSpan, parseOtlpHeaders } from "@volumetric/telemetry";

interface TelemetryEnv {
  [key: string]: string | undefined;
  OTEL_SERVICE_NAME?: string;
  OTEL_EXPORTER_OTLP_TRACES_ENDPOINT?: string;
  OTEL_EXPORTER_OTLP_LOGS_ENDPOINT?: string;
  OTEL_EXPORTER_OTLP_HEADERS?: string;
}

type LogLevel = "info" | "warn" | "error" | "debug";

const BOT_TRACER_NAME = "volumetric-bot";
const BOT_LOG_SCOPE_NAME = "volumetric-bot.logs";
const ATTR_SERVICE_NAME = "service.name";
const ATTR_SERVICE_INSTANCE_ID = "service.instance.id";
const CONTENT_TYPE_JSON = "application/json";

const OTEL_LOG_SEVERITY: Record<LogLevel, number> = {
  debug: 5,
  info: 9,
  warn: 13,
  error: 17,
};

interface TelemetryState {
  serviceName: string;
  serviceInstanceId: string;
  logsEndpoint?: string;
  otlpHeaders?: Record<string, string>;
}

const telemetryState: TelemetryState = {
  serviceName: BOT_TRACER_NAME,
  serviceInstanceId: "unknown",
};

export const withSpan = createWithSpan(BOT_TRACER_NAME);

function nowUnixNano(): string {
  return (BigInt(Date.now()) * BigInt(1_000_000)).toString();
}

function toOtelAttributes(attributes: Record<string, string | number | boolean>) {
  return Object.entries(attributes).map(([key, value]) => {
    if (typeof value === "string") {
      return { key, value: { stringValue: value } };
    }

    if (typeof value === "boolean") {
      return { key, value: { boolValue: value } };
    }

    if (Number.isInteger(value)) {
      return { key, value: { intValue: value.toString() } };
    }

    return { key, value: { doubleValue: value } };
  });
}

function exportOtelLog(
  level: LogLevel,
  message: string,
  attributes: Record<string, string | number | boolean>,
) {
  if (!telemetryState.logsEndpoint) {
    return;
  }

  const payload = {
    resourceLogs: [
      {
        resource: {
          attributes: [
            { key: ATTR_SERVICE_NAME, value: { stringValue: telemetryState.serviceName } },
            {
              key: ATTR_SERVICE_INSTANCE_ID,
              value: { stringValue: telemetryState.serviceInstanceId },
            },
          ],
        },
        scopeLogs: [
          {
            scope: { name: BOT_LOG_SCOPE_NAME },
            logRecords: [
              {
                timeUnixNano: nowUnixNano(),
                severityNumber: OTEL_LOG_SEVERITY[level],
                severityText: level.toUpperCase(),
                body: { stringValue: message },
                attributes: toOtelAttributes(attributes),
                traceId: trace.getActiveSpan()?.spanContext().traceId ?? "",
                spanId: trace.getActiveSpan()?.spanContext().spanId ?? "",
              },
            ],
          },
        ],
      },
    ],
  };

  void fetch(telemetryState.logsEndpoint, {
    method: "POST",
    headers: {
      ...(telemetryState.otlpHeaders ?? {}),
      "content-type": CONTENT_TYPE_JSON,
    },
    body: JSON.stringify(payload),
  }).catch((error) => {
    const otelError = error instanceof Error ? error.message : String(error);
    console.warn("Failed to export OTLP log", { error: otelError });
  });
}

export function initTelemetry(botName: string, env?: TelemetryEnv): void {
  telemetryState.serviceName = env?.OTEL_SERVICE_NAME?.trim() || BOT_TRACER_NAME;
  telemetryState.serviceInstanceId = botName;
  telemetryState.logsEndpoint = env?.OTEL_EXPORTER_OTLP_LOGS_ENDPOINT?.trim() || undefined;
  telemetryState.otlpHeaders = parseOtlpHeaders(env?.OTEL_EXPORTER_OTLP_HEADERS);
}

export async function shutdownTelemetry(): Promise<void> {
  return Promise.resolve();
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

  exportOtelLog(level, message, logAttributes);
}
