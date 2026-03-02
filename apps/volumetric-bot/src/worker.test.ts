import { beforeEach, describe, expect, test, vi } from "vitest";

const { createBotRuntimeMock, loadConfigMock, initTelemetryMock, shutdownTelemetryMock, logMock } =
  vi.hoisted(() => ({
    createBotRuntimeMock: vi.fn(),
    loadConfigMock: vi.fn(),
    initTelemetryMock: vi.fn(),
    shutdownTelemetryMock: vi.fn(),
    logMock: vi.fn(),
  }));

vi.mock("./bot.js", () => ({
  createBotRuntime: createBotRuntimeMock,
}));

vi.mock("./config.js", () => ({
  loadConfig: loadConfigMock,
}));

vi.mock("./telemetry.js", () => ({
  initTelemetry: initTelemetryMock,
  shutdownTelemetry: shutdownTelemetryMock,
  log: logMock,
}));

const WORKER_ENV = {
  NEXT_APP: {
    fetch: vi.fn(),
  },
  BOT_PRIVATE_KEY_WIF: "mock-wif",
  CANISTER_ID: "mock-canister-id",
} as const;

async function loadWorkerModule() {
  const workerModule = await import("./worker");
  return workerModule.default;
}

describe("worker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();

    loadConfigMock.mockReturnValue({
      privateKeyWif: "mock-wif",
      trpcUrl: "https://example.com/api/trpc",
      canisterId: "mock-canister-id",
      icHost: "https://ic0.app",
      btcNetwork: "testnet",
      intervalMs: 60_000,
      botName: "test-bot",
    });
  });

  test("should recover runtime initialization after a transient failure", async () => {
    // given
    createBotRuntimeMock
      .mockRejectedValueOnce(new Error("transient init failure"))
      .mockResolvedValue({
        runAction: vi.fn(),
        runRandomAction: vi.fn(),
        ensureSetup: vi.fn(),
        runActionWithResult: vi.fn().mockResolvedValue({ ok: true, action: "accept" }),
      });
    const worker = await loadWorkerModule();
    const request = new Request("https://example.com/run?action=accept", { method: "POST" });

    // when
    const firstResponse = await worker.fetch(request, WORKER_ENV);
    const secondResponse = await worker.fetch(request, WORKER_ENV);

    // then
    expect(firstResponse.status).toBe(500);
    expect(secondResponse.status).toBe(200);
    expect(createBotRuntimeMock).toHaveBeenCalledTimes(2);
  });

  test("should return failure response when action execution fails", async () => {
    // given
    createBotRuntimeMock.mockResolvedValue({
      runAction: vi.fn().mockResolvedValue(undefined),
      runRandomAction: vi.fn(),
      ensureSetup: vi.fn(),
      runActionWithResult: vi.fn().mockResolvedValue({ ok: false, error: "tick failed" }),
    });
    const worker = await loadWorkerModule();
    const request = new Request("https://example.com/run?action=create", { method: "POST" });

    // when
    const response = await worker.fetch(request, WORKER_ENV);
    const responseBody = await response.json();

    // then
    expect(response.status).toBe(500);
    expect(responseBody).toEqual({ ok: false, error: "tick failed", action: "create" });
  });
});
