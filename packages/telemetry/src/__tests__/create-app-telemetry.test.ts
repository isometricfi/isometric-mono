import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  createAppTelemetry,
  createProcessEnvResolver,
  getTraceHeaders,
  initTelemetry,
  shutdownTelemetry,
  withRemoteParentSpan,
  withSpan,
} from "../index";

describe("createProcessEnvResolver", () => {
  test("should return explicit env when provided", () => {
    // given
    const resolver = createProcessEnvResolver("my-service");
    const explicitEnv = {
      OTEL_SERVICE_NAME: "override-service",
      OTEL_EXPORTER_OTLP_TRACES_ENDPOINT: "https://traces.example",
    };

    // when
    const result = resolver(explicitEnv);

    // then
    expect(result).toBe(explicitEnv);
  });

  test("should fall back to process.env with default service name", () => {
    // given
    const resolver = createProcessEnvResolver("fallback-service");

    // when
    const result = resolver();

    // then
    expect(result).toBeDefined();
    expect(result?.OTEL_SERVICE_NAME).toBe("fallback-service");
  });

  test("should prefer process.env OTEL_SERVICE_NAME over default", () => {
    // given
    const originalValue = process.env.OTEL_SERVICE_NAME;
    process.env.OTEL_SERVICE_NAME = "env-service";
    const resolver = createProcessEnvResolver("fallback-service");

    // when
    const result = resolver();

    // then
    expect(result?.OTEL_SERVICE_NAME).toBe("env-service");
    process.env.OTEL_SERVICE_NAME = originalValue;
  });
});

describe("createAppTelemetry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("should initialize telemetry only once", () => {
    // given
    const telemetry = createAppTelemetry({
      serviceInstanceId: "test-instance",
    });

    // when
    telemetry.ensureInitialized({
      OTEL_SERVICE_NAME: "test-service",
    });
    telemetry.ensureInitialized({
      OTEL_SERVICE_NAME: "test-service",
    });

    // then
    expect(telemetry.logger).toBeDefined();
  });

  test("should expose a pino logger after initialization", () => {
    // given
    const telemetry = createAppTelemetry({
      serviceInstanceId: "auto-resolve-instance",
    });

    // when
    telemetry.ensureInitialized();

    // then
    const logger = telemetry.logger;
    expect(logger).toBeDefined();
    expect(typeof logger.info).toBe("function");
    expect(typeof logger.child).toBe("function");
  });

  test("should prefix method namespaces when methodNamespacePrefix is set", () => {
    // given
    const observedSpans: Array<{
      name: string;
      attributes: Record<string, string | number | boolean>;
    }> = [];

    const telemetry = createAppTelemetry({
      serviceInstanceId: "prefix-test",
      methodNamespacePrefix: "app.backend",
    });

    telemetry.ensureInitialized({
      OTEL_SERVICE_NAME: "prefix-test-service",
    });

    const service = {
      doWork() {
        return "done";
      },
    };

    // when
    const wrapped = telemetry.withSpanWrappedMethods("my_service", service, {
      onSpanStart: (name, attributes) => {
        observedSpans.push({ name, attributes });
      },
    });
    wrapped.doWork();

    // then
    expect(observedSpans).toHaveLength(1);
    expect(observedSpans[0].name).toBe("app.backend.my_service.doWork");
  });

  test("should wrap sync and async methods preserving return values", async () => {
    // given
    const telemetry = createAppTelemetry({
      serviceInstanceId: "wrap-test",
    });

    telemetry.ensureInitialized({
      OTEL_SERVICE_NAME: "wrap-test-service",
    });

    const service = {
      syncMethod(x: number) {
        return x * 2;
      },
      async asyncMethod(x: number) {
        return x + 10;
      },
    };

    const wrapped = telemetry.withSpanWrappedMethods("svc", service);

    // when
    const syncResult = wrapped.syncMethod(5);
    const asyncResult = await wrapped.asyncMethod(5);

    // then
    expect(syncResult).toBe(10);
    expect(asyncResult).toBe(15);
  });

  test("should preserve error behavior in wrapped methods", async () => {
    // given
    const telemetry = createAppTelemetry({
      serviceInstanceId: "error-test",
    });

    telemetry.ensureInitialized({
      OTEL_SERVICE_NAME: "error-test-service",
    });

    const service = {
      failSync() {
        throw new Error("sync boom");
      },
      async failAsync() {
        throw new Error("async boom");
      },
    };

    const wrapped = telemetry.withSpanWrappedMethods("err_svc", service);

    // when / then
    expect(() => wrapped.failSync()).toThrowError("sync boom");
    await expect(wrapped.failAsync()).rejects.toThrowError("async boom");
  });
});

const TRACEPARENT_REGEX = /^00-([0-9a-f]{32})-([0-9a-f]{16})-([0-9a-f]{2})$/;
const TRACE_ID_REGEX = /^[0-9a-f]{32}$/;

describe("trace context propagation", () => {
  afterEach(async () => {
    await shutdownTelemetry();
  });

  test("should return empty headers when no active span", () => {
    // given
    initTelemetry("propagation-test", {
      OTEL_SERVICE_NAME: "propagation-test",
      OTEL_EXPORTER_OTLP_TRACES_ENDPOINT: "http://localhost:4318/v1/traces",
    });

    // when
    const headers = getTraceHeaders();

    // then
    expect(headers).toEqual({});
  });

  test("should return traceparent header inside an active span", async () => {
    // given
    initTelemetry("propagation-test", {
      OTEL_SERVICE_NAME: "propagation-test",
      OTEL_EXPORTER_OTLP_TRACES_ENDPOINT: "http://localhost:4318/v1/traces",
    });

    // when
    let capturedHeaders: Record<string, string> = {};
    await withSpan("test.outer", {}, async () => {
      capturedHeaders = getTraceHeaders();
    });

    // then
    expect(capturedHeaders.traceparent).toBeDefined();
    expect(TRACEPARENT_REGEX.test(capturedHeaders.traceparent)).toBe(true);
  });

  test("should create child span from traceparent header", async () => {
    // given
    initTelemetry("propagation-test", {
      OTEL_SERVICE_NAME: "propagation-test",
      OTEL_EXPORTER_OTLP_TRACES_ENDPOINT: "http://localhost:4318/v1/traces",
    });

    const TRACE_ID = "4bf92f3577b16e8d0e8b3a1f4e2d1c5a";
    const PARENT_SPAN_ID = "d7a3b6c1e2f4a5b8";
    const incomingHeaders = {
      traceparent: `00-${TRACE_ID}-${PARENT_SPAN_ID}-01`,
    };

    // when
    let childTraceId = "";
    await withRemoteParentSpan(
      "web.api.trpc",
      incomingHeaders,
      { method: "POST" },
      async (span) => {
        childTraceId = span.spanContext().traceId;
      },
    );

    // then
    expect(childTraceId).toBe(TRACE_ID);
  });

  test("should propagate trace context end-to-end", async () => {
    // given
    initTelemetry("e2e-propagation", {
      OTEL_SERVICE_NAME: "e2e-propagation",
      OTEL_EXPORTER_OTLP_TRACES_ENDPOINT: "http://localhost:4318/v1/traces",
    });

    // when
    let injectedHeaders: Record<string, string> = {};
    let receivedTraceId = "";
    let originalTraceId = "";

    await withSpan("bot.action", {}, async () => {
      injectedHeaders = getTraceHeaders();
      originalTraceId = TRACEPARENT_REGEX.exec(injectedHeaders.traceparent)?.[1] ?? "";

      await withRemoteParentSpan("web.api.trpc", injectedHeaders, {}, async (innerSpan) => {
        receivedTraceId = innerSpan.spanContext().traceId;
      });
    });

    // then
    expect(originalTraceId).toHaveLength(32);
    expect(receivedTraceId).toBe(originalTraceId);
  });

  test("should expose active span context inside withSpan", async () => {
    // given
    initTelemetry("context-propagation", {
      OTEL_SERVICE_NAME: "context-propagation",
      OTEL_EXPORTER_OTLP_TRACES_ENDPOINT: "http://localhost:4318/v1/traces",
    });

    // when
    let traceId = "";
    await withSpan("bot.action", {}, async (span) => {
      span.addEvent("started");
      span.updateName("bot.action.updated");
      traceId = span.spanContext().traceId;
    });

    // then
    expect(TRACE_ID_REGEX.test(traceId)).toBe(true);
  });

  test("should fall back gracefully with invalid traceparent", async () => {
    // given
    initTelemetry("invalid-propagation", {
      OTEL_SERVICE_NAME: "invalid-propagation",
      OTEL_EXPORTER_OTLP_TRACES_ENDPOINT: "http://localhost:4318/v1/traces",
    });

    const invalidHeaders = { traceparent: "not-a-valid-traceparent" };

    // when
    const result = await withRemoteParentSpan("web.api.trpc", invalidHeaders, {}, async () => "ok");

    // then
    expect(result).toBe("ok");
  });

  test("should fall back gracefully with missing traceparent", async () => {
    // given
    initTelemetry("missing-propagation", {
      OTEL_SERVICE_NAME: "missing-propagation",
      OTEL_EXPORTER_OTLP_TRACES_ENDPOINT: "http://localhost:4318/v1/traces",
    });

    // when
    const result = await withRemoteParentSpan("web.api.trpc", {}, {}, async () => "ok");

    // then
    expect(result).toBe("ok");
  });
});
