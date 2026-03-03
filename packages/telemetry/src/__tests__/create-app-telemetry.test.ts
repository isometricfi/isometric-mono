import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { createAppTelemetry, createProcessEnvResolver } from "../index";

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
