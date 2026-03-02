# Volumetric Bot

## Cloudflare Worker mode

This package runs independent Workers from the same codebase:

- `volumetric-bot-1` (`--env bot1`)
- `volumetric-bot-2` (`--env bot2`)
- `volumetric-bot-3` (`--env bot3`)
- `volumetric-bot-4` (`--env bot4`)

Both use a service binding to `volumetric-web` for tRPC calls (`NEXT_APP`), so worker mode does not use public `TRPC_URL`.

## Config quick reference

- `pn bot` (Node mode) reads `./.env`
- `wrangler dev --env botX` reads `wrangler.toml` + `./.dev.vars.botX`
- `wrangler deploy --env botX` reads `wrangler.toml` + Cloudflare secrets
- Deploy does not read `./.dev.vars.botX`

Store values here:

- Public/non-secret: `wrangler.toml` (`[env.botX.vars]`)
- Local worker secrets: `.dev.vars.botX`
- Deployed worker secrets: `wrangler secret put ... --env botX`
- Local node secrets: `.env`

### 1) Authenticate Wrangler

```bash
npx wrangler whoami
```

If needed:

```bash
npx wrangler login
```

### 2) Configure secrets

For local worker development, copy `.dev.vars.example` to `.dev.vars.bot1` (or `.dev.vars.botX`) and set real values.

Set required secrets per worker environment:

```bash
npx wrangler secret put BOT_PRIVATE_KEY_WIF --env bot1
npx wrangler secret put CANISTER_ID --env bot1

npx wrangler secret put BOT_PRIVATE_KEY_WIF --env bot2
npx wrangler secret put CANISTER_ID --env bot2

npx wrangler secret put BOT_PRIVATE_KEY_WIF --env bot3
npx wrangler secret put CANISTER_ID --env bot3

npx wrangler secret put BOT_PRIVATE_KEY_WIF --env bot4
npx wrangler secret put CANISTER_ID --env bot4
```

Optional telemetry secrets (if exporting OTLP traces/logs):

```bash
npx wrangler secret put OTEL_EXPORTER_AUTH --env bot1
npx wrangler secret put OTEL_EXPORTER_AUTH --env bot2
npx wrangler secret put OTEL_EXPORTER_AUTH --env bot3
npx wrangler secret put OTEL_EXPORTER_AUTH --env bot4
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
pnpm --filter @volumetric/bot worker:deploy:bot3
pnpm --filter @volumetric/bot worker:deploy:bot4
```

### Endpoints

- `GET /health`
- `POST /run?action=create`
- `POST /run?action=accept`

All workers are configured with the same cron schedule to exercise race conditions.

## Race-condition verification runbook (3-4 bots)

### Goal

Verify every bot selects the same top offer ID for acceptance, and only one bot succeeds per race wave.

### Preconditions

- Each bot wallet is set and funded.
- All bot environments use the same canister and service binding.
- Existing market has at least one valid offer with `termDays <= 3`.

### Step 1) Capture baseline balances

For each bot wallet address, capture account balance before the wave.

### Step 2) Start tails in parallel

```bash
pnpm --filter @volumetric/bot worker:tail:bot1
pnpm --filter @volumetric/bot worker:tail:bot2
pnpm --filter @volumetric/bot worker:tail:bot3
pnpm --filter @volumetric/bot worker:tail:bot4
```

### Step 3) Trigger concurrent accept wave

Send concurrent requests to each worker `POST /run?action=accept`.

### Step 4) Validate race outcome

- Confirm each bot logs the same `selected_offer_id`.
- Confirm only one bot logs `Offer accepted` for that offer ID.
- Confirm other bots fail or skip safely with no duplicate fill.

### Step 5) Validate balances

- Winner bot balance should reflect premium and fees.
- Non-winning bots should have no unexpected deduction.

### Step 6) Repeat a second wave

Repeat Step 3 to Step 5 to verify behavior remains stable on subsequent runs.
