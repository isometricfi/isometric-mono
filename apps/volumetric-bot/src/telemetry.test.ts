import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const { getActiveSpanMock } = vi.hoisted(() => ({
  getActiveSpanMock: vi.fn(),
}));

vi.mock("@opentelemetry/api", async () => {
  const actual = await vi.importActual<typeof import("@opentelemetry/api")>("@opentelemetry/api");

  return {
    ...actual,
    trace: {
      getTracer: vi.fn(() => ({
        startActiveSpan: vi.fn(),
      })),
      getActiveSpan: getActiveSpanMock,
    },
  };
});

import { initTelemetry, log } from "./telemetry";

describe("log", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockResolvedValue(new Response(null, { status: 200 }));
    getActiveSpanMock.mockReturnValue({
      spanContext: () => ({
        traceId: "trace-id",
        spanId: "span-id",
      }),
    });

    initTelemetry("test-bot", {
      OTEL_EXPORTER_OTLP_LOGS_ENDPOINT: "https://otel.example/v1/logs",
      OTEL_EXPORTER_OTLP_HEADERS: "Authorization=Bearer%20token",
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("should export linked OTLP logs with active span context", async () => {
    // when
    log("info", "Tick completed", { iteration: 1 });
    await Promise.resolve();

    // then
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [endpoint, requestInit] = fetchMock.mock.calls[0];
    const payload = JSON.parse(String(requestInit?.body));
    const logRecord = payload.resourceLogs[0].scopeLogs[0].logRecords[0];

    expect(endpoint).toBe("https://otel.example/v1/logs");
    expect(requestInit?.headers).toMatchObject({
      Authorization: "Bearer token",
      "content-type": "application/json",
    });
    expect(logRecord.traceId).toBe("trace-id");
    expect(logRecord.spanId).toBe("span-id");
    expect(logRecord.body.stringValue).toBe("Tick completed");
  });
});
