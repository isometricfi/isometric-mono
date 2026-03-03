import type { Span } from "@opentelemetry/api";
import type pino from "pino";
import type {
  AppTelemetry,
  CreateAppTelemetryOptions,
  LogLevel,
  SpanAttributes,
  SpanWrappedMethodsOptions,
  TelemetryEnv,
} from "../types";
import {
  createProcessEnvResolver,
  getLogger,
  getTraceHeaders,
  initTelemetry,
  log,
  shutdownTelemetry,
  withRemoteParentSpan,
  withSpan,
  withSpanWrappedMethods,
} from "./runtime";

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

  const runWithRemoteParentSpan = async <T>(
    name: string,
    headers: Record<string, string | undefined>,
    attributes: SpanAttributes,
    fn: (span: Span) => Promise<T>,
  ): Promise<T> => {
    ensureInitialized();
    return withRemoteParentSpan(name, headers, attributes, fn);
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

  const resolveLogger = (): pino.Logger => {
    ensureInitialized();
    return getLogger();
  };

  return {
    ensureInitialized,
    get logger() {
      return resolveLogger();
    },
    getTraceHeaders,
    withSpan: runWithSpan,
    withRemoteParentSpan: runWithRemoteParentSpan,
    log: emitLog,
    shutdown: shutdownTelemetry,
    withSpanWrappedMethods: wrapMethods,
  };
}
