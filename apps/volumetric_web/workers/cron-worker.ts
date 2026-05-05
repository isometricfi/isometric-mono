/// <reference types="@cloudflare/workers-types" />

export interface Env {
  CRON_SECRET: string;
  NEXT_APP: Fetcher;
}

const ONE_MINUTE_CRON = "* * * * *";

async function callCronEndpoint(env: Env, path: string): Promise<unknown> {
  const res = await env.NEXT_APP.fetch(`https://dummy${path}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${env.CRON_SECRET}`,
    },
  });
  return res.json();
}

const worker: ExportedHandler<Env> = {
  async scheduled(event, env, ctx) {
    if (event.cron !== ONE_MINUTE_CRON) {
      return;
    }

    ctx.waitUntil(
      callCronEndpoint(env, "/api/cron/sync-events")
        .then((data) => console.log("Cron sync result:", data))
        .catch((err) => console.error("Cron sync failed:", err)),
    );
    ctx.waitUntil(
      callCronEndpoint(env, "/api/cron/sync-deposits")
        .then((data) => console.log("Deposit sync result:", data))
        .catch((err) => console.error("Deposit sync failed:", err)),
    );
    ctx.waitUntil(
      callCronEndpoint(env, "/api/cron/sync-withdrawals")
        .then((data) => console.log("Withdrawal sync result:", data))
        .catch((err) => console.error("Withdrawal sync failed:", err)),
    );
    ctx.waitUntil(
      callCronEndpoint(env, "/api/cron/sync-market-data")
        .then((data) => console.log("Market data sync result:", data))
        .catch((err) => console.error("Market data sync failed:", err)),
    );
    ctx.waitUntil(
      callCronEndpoint(env, "/api/cron/sync-xrc-price")
        .then((data) => console.log("XRC price sync result:", data))
        .catch((err) => console.error("XRC price sync failed:", err)),
    );
    ctx.waitUntil(
      callCronEndpoint(env, "/api/cron/ship-canister-logs")
        .then((data) => console.log("Canister log ship result:", data))
        .catch((err) => console.error("Canister log ship failed:", err)),
    );
  },
};

export default worker;
