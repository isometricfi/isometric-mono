/// <reference types="@cloudflare/workers-types" />

export interface Env {
  CRON_SECRET: string;
  NEXT_APP: Fetcher;
}

const EVERY_MINUTE_CRON = "* * * * *";

async function callCronEndpoint(env: Env, path: string): Promise<unknown> {
  const res = await env.NEXT_APP.fetch(`https://dummy${path}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${env.CRON_SECRET}`,
    },
  });
  if (!res.ok) {
    throw new Error(`Cron endpoint ${path} failed with status ${res.status}`);
  }
  return res.json();
}

const worker: ExportedHandler<Env> = {
  async scheduled(event, env, ctx) {
    if (event.cron !== EVERY_MINUTE_CRON) {
      return;
    }
    ctx.waitUntil(
      callCronEndpoint(env, "/api/cron/sync-market-data")
        .then((data) => console.log("Market data sync result:", data))
        .catch((err) => console.error("Market data sync failed:", err)),
    );
  },
};

export default worker;
