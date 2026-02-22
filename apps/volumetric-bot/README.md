# Volumetric Bot

## Cloudflare Worker mode

This package runs two independent Workers from the same codebase:

- `volumetric-bot-1` (`--env bot1`)
- `volumetric-bot-2` (`--env bot2`)

Both use a service binding to `volumetric-web` for tRPC calls (`NEXT_APP`), so worker mode does not use public `TRPC_URL`.

### 1) Authenticate Wrangler

```bash
npx wrangler whoami
```

If needed:

```bash
npx wrangler login
```

### 2) Configure secrets

For local development, copy `.dev.vars.example` to `.dev.vars` and set real values.

Set required secrets per worker environment:

```bash
npx wrangler secret put BOT_PRIVATE_KEY_WIF --env bot1
npx wrangler secret put CANISTER_ID --env bot1

npx wrangler secret put BOT_PRIVATE_KEY_WIF --env bot2
npx wrangler secret put CANISTER_ID --env bot2
```

Optional telemetry secrets (if exporting OTLP traces/logs):

```bash
npx wrangler secret put OTEL_EXPORTER_AUTH --env bot1
npx wrangler secret put OTEL_EXPORTER_AUTH --env bot2
```

Non-secret vars are in `wrangler.toml` per env (`BTC_NETWORK`, `IC_HOST`, `BOT_NAME`).

`INTERVAL_MS` applies to Node loop mode only and is not used for Worker cron scheduling.

Optional telemetry vars (can be set in `.dev.vars.*` locally, or Wrangler vars for deployed workers):

- `OTEL_SERVICE_NAME`
- `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT`
- `OTEL_EXPORTER_OTLP_LOGS_ENDPOINT`

### 3) Run locally

```bash
pnpm --filter @volumetric/bot worker:dev
```

### 4) Deploy

```bash
pnpm --filter @volumetric/bot worker:deploy:bot1
pnpm --filter @volumetric/bot worker:deploy:bot2
```

### Endpoints

- `GET /health`
- `POST /run?action=create`
- `POST /run?action=accept`

Both workers are configured to run every minute (same schedule) to exercise race conditions.
