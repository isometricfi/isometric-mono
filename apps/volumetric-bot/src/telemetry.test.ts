import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { initTelemetry, withSpan } from "./telemetry";

describe("withSpan", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockResolvedValue(new Response(null, { status: 200 }));
    initTelemetry("test-bot", {
      OTEL_EXPORTER_OTLP_TRACES_ENDPOINT: "https://otel.example/v1/traces",
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("should preserve trace id and parent span id in nested spans", async () => {
    // when
    await withSpan("bot.run_loop", {}, async () => {
      await withSpan("bot.tick", {}, async () => Promise.resolve());
    });

    // then
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const childPayload = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    const parentPayload = JSON.parse(String(fetchMock.mock.calls[1][1]?.body));
    const childSpan = childPayload.resourceSpans[0].scopeSpans[0].spans[0];
    const parentSpan = parentPayload.resourceSpans[0].scopeSpans[0].spans[0];

    expect(childSpan.traceId).toBe(parentSpan.traceId);
    expect(childSpan.parentSpanId).toBe(parentSpan.spanId);
  });
});
