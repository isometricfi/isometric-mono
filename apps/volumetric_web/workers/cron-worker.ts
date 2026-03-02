/// <reference types="@cloudflare/workers-types" />
import { initTelemetry, log, withSpan } from "@volumetric/telemetry";

export interface Env {
  CRON_SECRET: string;
  NEXT_APP: Fetcher;
  OTEL_SERVICE_NAME?: string;
  OTEL_EXPORTER_OTLP_TRACES_ENDPOINT?: string;
  OTEL_EXPORTER_OTLP_LOGS_ENDPOINT?: string;
  OTEL_EXPORTER_AUTH?: string;
}

const ONE_MINUTE_CRON = "* * * * *";
const FIVE_MINUTES_CRON = "*/5 * * * *";
const WEB_CRON_INSTANCE_ID = "volumetric-web-cron";
let telemetryInitialized = false;

async function callCronEndpoint(env: Env, path: string): Promise<unknown> {
  return withSpan("web.worker.call_cron_endpoint", { path }, async () => {
    const res = await env.NEXT_APP.fetch(`https://dummy${path}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${env.CRON_SECRET}`,
      },
    });
    return res.json();
  });
}

function ensureCronTelemetryInitialized(env: Env): void {
  if (telemetryInitialized) {
    return;
  }

  initTelemetry(WEB_CRON_INSTANCE_ID, {
    OTEL_SERVICE_NAME: env.OTEL_SERVICE_NAME ?? "volumetric-web",
    OTEL_EXPORTER_OTLP_TRACES_ENDPOINT: env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT,
    OTEL_EXPORTER_OTLP_LOGS_ENDPOINT: env.OTEL_EXPORTER_OTLP_LOGS_ENDPOINT,
    OTEL_EXPORTER_AUTH: env.OTEL_EXPORTER_AUTH,
  });
  telemetryInitialized = true;
}

const worker: ExportedHandler<Env> = {
  async scheduled(event, env, ctx) {
    ensureCronTelemetryInitialized(env);
    switch (event.cron) {
      case ONE_MINUTE_CRON:
        ctx.waitUntil(
          callCronEndpoint(env, "/api/cron/sync-events")
            .then(() => log("info", "Cron sync result", { endpoint: "/api/cron/sync-events" }))
            .catch((error) => {
              const message = error instanceof Error ? error.message : String(error);
              log("error", "Cron sync failed", { error: message });
            }),
        );
        ctx.waitUntil(
          callCronEndpoint(env, "/api/cron/sync-deposits")
            .then(() => log("info", "Deposit sync result", { endpoint: "/api/cron/sync-deposits" }))
            .catch((error) => {
              const message = error instanceof Error ? error.message : String(error);
              log("error", "Deposit sync failed", { error: message });
            }),
        );
        break;
      case FIVE_MINUTES_CRON:
        ctx.waitUntil(
          callCronEndpoint(env, "/api/cron/test")
            .then(() => log("info", "Test cron result", { endpoint: "/api/cron/test" }))
            .catch((error) => {
              const message = error instanceof Error ? error.message : String(error);
              log("error", "Test cron failed", { error: message });
            }),
        );
        break;
    }
  },
};

export default worker;
