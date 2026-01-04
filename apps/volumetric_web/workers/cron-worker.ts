/// <reference types="@cloudflare/workers-types" />

export interface Env {
  CRON_SECRET: string;
  NEXT_APP: Fetcher;
}

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
    switch (event.cron) {
      case "* * * * *":
        ctx.waitUntil(
          callCronEndpoint(env, "/api/cron/sync-events")
            .then((data) => console.log("Cron sync result:", data))
            .catch((err) => console.error("Cron sync failed:", err)),
        );
        break;
      case "*/5 * * * *":
        ctx.waitUntil(
          callCronEndpoint(env, "/api/cron/test")
            .then((data) => console.log("Test cron result:", data))
            .catch((err) => console.error("Test cron failed:", err)),
        );
        break;
    }
  },
};

export default worker;
