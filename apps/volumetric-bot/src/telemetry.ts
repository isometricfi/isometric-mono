import type { Span } from "@opentelemetry/api";

interface TelemetryEnv {
  [key: string]: string | undefined;
  OTEL_SERVICE_NAME?: string;
  OTEL_EXPORTER_OTLP_TRACES_ENDPOINT?: string;
  OTEL_EXPORTER_OTLP_LOGS_ENDPOINT?: string;
  OTEL_EXPORTER_AUTH?: string;
}

type LogLevel = "info" | "warn" | "error" | "debug";

const BOT_TRACER_NAME = "volumetric-bot";
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
  serviceName: BOT_TRACER_NAME,
  serviceInstanceId: "unknown",
};

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

function nowUnixNano(): string {
  return (BigInt(Date.now()) * 1_000_000n).toString();
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

function withOtelHeaders(baseHeaders: Record<string, string>): Record<string, string> {
  if (!telemetryState.authHeader) {
    return baseHeaders;
  }

  return {
    ...baseHeaders,
    Authorization: telemetryState.authHeader,
  };
}

function randomHex(bytes: number): string {
  const values = new Uint8Array(bytes);
  crypto.getRandomValues(values);
  return Array.from(values, (value) => value.toString(16).padStart(2, "0")).join("");
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
            scope: { name: BOT_TRACER_NAME },
            logRecords: [
              {
                timeUnixNano: nowUnixNano(),
                severityNumber: OTEL_LOG_SEVERITY[level],
                severityText: level.toUpperCase(),
                body: { stringValue: message },
                attributes: toOtelAttributes(attributes),
              },
            ],
          },
        ],
      },
    ],
  };

  void fetch(telemetryState.logsEndpoint, {
    method: "POST",
    headers: withOtelHeaders({ "content-type": "application/json" }),
    body: JSON.stringify(payload),
  }).catch((error) => {
    const otelError = error instanceof Error ? error.message : String(error);
    console.warn("Failed to export OTLP log", { error: otelError });
  });
}

function exportOtelSpan(
  spanName: string,
  traceId: string,
  spanId: string,
  startTimeUnixNano: string,
  endTimeUnixNano: string,
  statusCode: 0 | 1 | 2,
  statusMessage: string | undefined,
  attributes: Record<string, string | number | boolean>,
) {
  if (!telemetryState.tracesEndpoint) {
    return;
  }

  const payload = {
    resourceSpans: [
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
        scopeSpans: [
          {
            scope: { name: BOT_TRACER_NAME },
            spans: [
              {
                traceId,
                spanId,
                name: spanName,
                startTimeUnixNano,
                endTimeUnixNano,
                attributes: toOtelAttributes(attributes),
                status: {
                  code: statusCode,
                  message: statusMessage,
                },
              },
            ],
          },
        ],
      },
    ],
  };

  void fetch(telemetryState.tracesEndpoint, {
    method: "POST",
    headers: withOtelHeaders({ "content-type": "application/json" }),
    body: JSON.stringify(payload),
  }).catch((error) => {
    const otelError = error instanceof Error ? error.message : String(error);
    console.warn("Failed to export OTLP span", { error: otelError });
  });
}

export function initTelemetry(botName: string, env?: TelemetryEnv): void {
  telemetryState.serviceName = env?.OTEL_SERVICE_NAME ?? BOT_TRACER_NAME;
  telemetryState.serviceInstanceId = botName;
  telemetryState.tracesEndpoint = env?.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT;
  telemetryState.logsEndpoint = env?.OTEL_EXPORTER_OTLP_LOGS_ENDPOINT;
  telemetryState.authHeader = parseAuthorizationHeader(env?.OTEL_EXPORTER_AUTH);
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

type SpanAttributes = Record<string, string | number | boolean>;

export async function withSpan<T>(
  name: string,
  attributes: SpanAttributes,
  fn: (span: Span) => Promise<T>,
): Promise<T> {
  const traceId = randomHex(16);
  const spanId = randomHex(8);
  const spanAttributes: SpanAttributes = { ...attributes };
  const startTimeUnixNano = nowUnixNano();

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
      traceId,
      spanId,
      traceFlags: 1,
      isRemote: false,
    }),
  } as unknown as Span;

  try {
    const result = await fn(spanShim);
    exportOtelSpan(
      name,
      traceId,
      spanId,
      startTimeUnixNano,
      nowUnixNano(),
      1,
      undefined,
      spanAttributes,
    );
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    spanAttributes["error.message"] = message;
    exportOtelSpan(
      name,
      traceId,
      spanId,
      startTimeUnixNano,
      nowUnixNano(),
      2,
      message,
      spanAttributes,
    );
    throw error;
  }
}
