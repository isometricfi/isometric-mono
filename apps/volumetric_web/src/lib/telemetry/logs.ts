import "server-only";

import { trace } from "@opentelemetry/api";
import { parseOtlpHeaders } from "@volumetric/telemetry";
import { WEB_APP_TRACER_NAME } from "./traceConstants";

const CONTENT_TYPE_JSON = "application/json";
const LOG_SCOPE_NAME = "volumetric-web.logs";
const OTEL_HEADERS = parseOtlpHeaders(process.env.OTEL_EXPORTER_OTLP_HEADERS);
const OTEL_LOGS_ENDPOINT = process.env.OTEL_EXPORTER_OTLP_LOGS_ENDPOINT;
const OTEL_SERVICE_NAME = process.env.OTEL_SERVICE_NAME;
const OTEL_SEVERITY_NUMBER_ERROR = 17;
const OTEL_SEVERITY_NUMBER_INFO = 9;

export async function logInfo(message: string): Promise<void> {
  console.info(message);
  await sendLog(message, OTEL_SEVERITY_NUMBER_INFO, "INFO");
}

export async function logError(message: string, error?: unknown): Promise<void> {
  if (error === undefined) {
    console.error(message);
  } else {
    console.error(message, error);
  }

  await sendLog(getErrorMessage(message, error), OTEL_SEVERITY_NUMBER_ERROR, "ERROR");
}

async function sendLog(
  message: string,
  severityNumber: number,
  severityText: string,
): Promise<void> {
  if (!OTEL_LOGS_ENDPOINT) {
    return;
  }

  const spanContext = trace.getActiveSpan()?.spanContext();

  try {
    const response = await fetch(OTEL_LOGS_ENDPOINT, {
      method: "POST",
      headers: {
        ...(OTEL_HEADERS ?? {}),
        "Content-Type": CONTENT_TYPE_JSON,
      },
      body: JSON.stringify({
        resourceLogs: [
          {
            resource: {
              attributes: [
                {
                  key: "service.name",
                  value: {
                    stringValue: OTEL_SERVICE_NAME?.trim() || WEB_APP_TRACER_NAME,
                  },
                },
              ],
            },
            scopeLogs: [
              {
                scope: {
                  name: LOG_SCOPE_NAME,
                },
                logRecords: [
                  {
                    timeUnixNano: getUnixTimeNanoseconds(),
                    severityNumber,
                    severityText,
                    body: {
                      stringValue: message,
                    },
                    traceId: spanContext?.traceId ?? "",
                    spanId: spanContext?.spanId ?? "",
                  },
                ],
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      console.error("Failed to export OTLP log", response.status, response.statusText);
    }
  } catch (error) {
    console.error("Failed to export OTLP log", error);
  }
}

function getErrorMessage(message: string, error?: unknown): string {
  if (error instanceof Error && error.message) {
    return `${message}: ${error.message}`;
  }

  if (typeof error === "string" && error.length > 0) {
    return `${message}: ${error}`;
  }

  return message;
}

function getUnixTimeNanoseconds(): string {
  return (BigInt(Date.now()) * BigInt(1_000_000)).toString();
}
