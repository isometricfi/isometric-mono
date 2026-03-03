import { describe, expect, test } from "vitest";
import { ensureWebTelemetryInitialized, withWebSpanWrappedMethods } from "@/lib/telemetry";

describe("web telemetry shim", () => {
  test("should initialize telemetry idempotently", () => {
    // when
    ensureWebTelemetryInitialized({ OTEL_SERVICE_NAME: "test-service-name" });
    ensureWebTelemetryInitialized({ OTEL_SERVICE_NAME: "test-service-name" });

    // then
    expect(ensureWebTelemetryInitialized).toBeDefined();
  });

  test("should wrap sync and async methods and include custom attributes", async () => {
    // given
    const observedSpans: Array<{
      name: string;
      attributes: Record<string, string | number | boolean>;
    }> = [];

    const service = {
      getDisplayName(userId: string) {
        return `display:${userId}`;
      },
      async getProfile(userId: string) {
        return { id: userId, username: "alice" };
      },
    };

    ensureWebTelemetryInitialized({ OTEL_SERVICE_NAME: "test-service-name" });

    const wrappedService = withWebSpanWrappedMethods("test_service", service, {
      getAttributes: (args) => {
        const firstArg = args[0];
        if (typeof firstArg === "string" && firstArg.length > 0) {
          return { user_id: firstArg };
        }
        return {};
      },
      onSpanStart: (name, attributes) => {
        observedSpans.push({ name, attributes });
      },
    });

    // when
    const displayName = wrappedService.getDisplayName("user-123");
    const profile = await wrappedService.getProfile("user-123");

    // then
    expect(displayName).toBe("display:user-123");
    expect(profile).toEqual({ id: "user-123", username: "alice" });
    expect(observedSpans).toEqual([
      {
        name: "web.backend.test_service.getDisplayName",
        attributes: { arg_count: 1, user_id: "user-123" },
      },
      {
        name: "web.backend.test_service.getProfile",
        attributes: { arg_count: 1, user_id: "user-123" },
      },
    ]);
  });

  test("should preserve error behavior for sync and async methods", async () => {
    // given
    const service = {
      failSync() {
        throw new Error("sync failed");
      },
      async failAsync() {
        throw new Error("async failed");
      },
    };

    ensureWebTelemetryInitialized({ OTEL_SERVICE_NAME: "test-service-name" });

    const wrappedService = withWebSpanWrappedMethods("error_service", service);

    // when
    const failSync = () => wrappedService.failSync();
    const failAsync = () => wrappedService.failAsync();

    // then
    expect(failSync).toThrowError("sync failed");
    await expect(failAsync()).rejects.toThrowError("async failed");
  });
});
