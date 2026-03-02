import type { Span } from "@opentelemetry/api";
import {
  initTelemetry,
  type LogLevel,
  log,
  shutdownTelemetry,
  type TelemetryEnv,
  withSpan,
} from "@volumetric/telemetry";

type SpanAttributes = Record<string, string | number | boolean>;

const WEB_SERVICE_INSTANCE_ID = "volumetric-web";
let telemetryInitialized = false;

function resolveTelemetryEnv(explicitEnv?: TelemetryEnv): TelemetryEnv | undefined {
  if (explicitEnv) {
    return explicitEnv;
  }

  if (typeof process !== "undefined") {
    return {
      ...process.env,
      OTEL_SERVICE_NAME: process.env.OTEL_SERVICE_NAME ?? WEB_SERVICE_INSTANCE_ID,
    };
  }

  return undefined;
}

export function ensureWebTelemetryInitialized(explicitEnv?: TelemetryEnv): void {
  if (telemetryInitialized) {
    return;
  }

  initTelemetry(WEB_SERVICE_INSTANCE_ID, resolveTelemetryEnv(explicitEnv));
  telemetryInitialized = true;
}

export async function withWebSpan<T>(
  name: string,
  attributes: SpanAttributes,
  fn: (span: Span) => Promise<T>,
): Promise<T> {
  ensureWebTelemetryInitialized();
  return withSpan(name, attributes, fn);
}

export function webLog(
  level: LogLevel,
  message: string,
  attributes?: Record<string, string | number | boolean>,
): void {
  ensureWebTelemetryInitialized();
  log(level, message, attributes);
}

export async function shutdownWebTelemetry(): Promise<void> {
  await shutdownTelemetry();
}
