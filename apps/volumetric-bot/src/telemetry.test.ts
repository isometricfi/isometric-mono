import { describe, expect, test, vi } from "vitest";
import { initBotTelemetry, withBotSpan } from "./telemetry";

describe("withBotSpan", () => {
  test("should execute nested spans and return inner result", async () => {
    // given
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    initBotTelemetry({ OTEL_SERVICE_NAME: "test-bot" });

    // when
    const result = await withBotSpan("bot.outer", {}, async (outerSpan) => {
      outerSpan.setAttribute("outer_key", "outer_value");

      return withBotSpan("bot.inner", {}, async (innerSpan) => {
        innerSpan.setAttribute("inner_key", "inner_value");
        return "nested-result";
      });
    });

    // then
    expect(result).toBe("nested-result");
  });

  test("should propagate errors from inner spans", async () => {
    // given
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    initBotTelemetry({ OTEL_SERVICE_NAME: "test-bot" });

    // when / then
    await expect(
      withBotSpan("bot.outer", {}, async () => {
        return withBotSpan("bot.inner", {}, async () => {
          throw new Error("inner failure");
        });
      }),
    ).rejects.toThrowError("inner failure");
  });
});
