import type { BotRuntime } from "./bot.js";
import { createBotRuntime } from "./bot.js";
import { type BotEnv, loadConfig } from "./config.js";
import { initTelemetry, log, shutdownTelemetry } from "./telemetry.js";

interface WorkerExecutionContext {
  waitUntil: (promise: Promise<unknown>) => void;
}

interface ServiceBindingFetcher {
  fetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
}

type WorkerEnv = BotEnv & {
  NEXT_APP: ServiceBindingFetcher;
  OTEL_EXPORTER_OTLP_LOGS_ENDPOINT?: string;
};

let cachedRuntimePromise: Promise<BotRuntime> | null = null;
let telemetryInitialized = false;

async function getRuntime(env: WorkerEnv) {
  const config = loadConfig(env);

  if (!telemetryInitialized) {
    initTelemetry(config.botName, env);
    telemetryInitialized = true;
  }

  if (!cachedRuntimePromise) {
    cachedRuntimePromise = createBotRuntime(config, {
      trpcUrl: "https://dummy/api/trpc",
      trpcFetch: (input, init) => env.NEXT_APP.fetch(input, init),
    });
  }

  return cachedRuntimePromise;
}

async function runScheduledTick(env: WorkerEnv): Promise<void> {
  const runtime = await getRuntime(env);
  await runtime.runRandomAction();
}

async function runActionFromRequest(request: Request, env: WorkerEnv): Promise<Response> {
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ ok: false, error: "Method not allowed" }), {
      status: 405,
      headers: { "content-type": "application/json" },
    });
  }

  const url = new URL(request.url);
  const action = url.searchParams.get("action");

  if (action !== "create" && action !== "accept") {
    return new Response(
      JSON.stringify({
        ok: false,
        error: "Invalid action. Use ?action=create or ?action=accept",
      }),
      {
        status: 400,
        headers: { "content-type": "application/json" },
      },
    );
  }

  const runtime = await getRuntime(env);
  await runtime.runAction(action);

  return new Response(JSON.stringify({ ok: true, action }), {
    headers: { "content-type": "application/json" },
  });
}

export default {
  async scheduled(
    _controller: unknown,
    env: WorkerEnv,
    ctx: WorkerExecutionContext,
  ): Promise<void> {
    ctx.waitUntil(
      runScheduledTick(env).catch((error) => {
        const message = error instanceof Error ? error.message : String(error);
        log("error", "Scheduled tick failed", { error: message });
      }),
    );
  },

  async fetch(request: Request, env: WorkerEnv): Promise<Response> {
    try {
      const url = new URL(request.url);

      if (url.pathname === "/health") {
        return new Response(JSON.stringify({ ok: true }), {
          headers: { "content-type": "application/json" },
        });
      }

      if (url.pathname === "/run") {
        return runActionFromRequest(request, env);
      }

      return new Response(
        JSON.stringify({
          ok: true,
          endpoints: ["GET /health", "POST /run?action=create", "POST /run?action=accept"],
        }),
        { headers: { "content-type": "application/json" } },
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      log("error", "Request failed", { error: message });
      await shutdownTelemetry();
      return new Response(JSON.stringify({ ok: false, error: message }), {
        status: 500,
        headers: { "content-type": "application/json" },
      });
    }
  },
};
