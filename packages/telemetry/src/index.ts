export type { Logger } from "pino";
export { createAppTelemetry } from "./_internal/create-app-telemetry";
export {
  createProcessEnvResolver,
  getTraceHeaders,
  initTelemetry,
  log,
  shutdownTelemetry,
  withRemoteParentSpan,
  withSpan,
  withSpanWrappedMethods,
} from "./_internal/runtime";
export type {
  AppTelemetry,
  CreateAppTelemetryOptions,
  LogLevel,
  SpanWrappedMethodsOptions,
  TelemetryEnv,
} from "./types";
