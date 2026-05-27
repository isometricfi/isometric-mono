# Isometric Bot

Automation bot for Isometric market operations and race-condition testing. It can run as a local Node process or as Cloudflare Workers.

## Modes

| Mode | Description |
|------|-------------|
| Node | Runs `src/index.ts` locally and reads `.env` |
| Worker | Runs `src/worker.ts` on Cloudflare and reads `wrangler.toml`, `.dev.vars.*`, and Cloudflare secrets |

Worker mode defines four environments: `bot1`, `bot2`, `bot3`, and `bot4`. Each Worker uses the `NEXT_APP` service binding for tRPC calls to `volumetric-web-dev`.

## Setup

Install dependencies from the repository root:

```bash
pnpm install
```

For Node mode:

```bash
cp apps/volumetric-bot/.env.example apps/volumetric-bot/.env
```

For local Worker mode, copy `.dev.vars.example` to the bot environment you want to run:

```bash
cp apps/volumetric-bot/.dev.vars.example apps/volumetric-bot/.dev.vars.bot1
```

Required secrets:

- `BOT_PRIVATE_KEY_WIF`
- `CANISTER_ID`

Optional telemetry variables are documented in `.env.example` and `.dev.vars.example`.

## Development

Run the Node bot:

```bash
pnpm --filter @volumetric/bot bot
```

Run a Worker locally:

```bash
pnpm --filter @volumetric/bot worker:dev:bot1
```

## Commands

| Command | Description |
|---------|-------------|
| `pnpm --filter @volumetric/bot bot` | Run Node mode |
| `pnpm --filter @volumetric/bot worker:dev:bot1` | Run Worker mode locally for `bot1` |
| `pnpm --filter @volumetric/bot worker:deploy:bot1` | Deploy `bot1` |
| `pnpm --filter @volumetric/bot worker:deploy:all` | Deploy all bot Workers |
| `pnpm --filter @volumetric/bot worker:tail:bot1` | Tail `bot1` logs |
| `pnpm --filter @volumetric/bot test` | Run tests |
| `pnpm --filter @volumetric/bot typecheck` | Run TypeScript checks |

## Worker Secrets

Set deployed Worker secrets with Wrangler:

```bash
pnpm --filter @volumetric/bot exec wrangler secret put BOT_PRIVATE_KEY_WIF --env bot1
pnpm --filter @volumetric/bot exec wrangler secret put CANISTER_ID --env bot1
```

Repeat for `bot2`, `bot3`, and `bot4` as needed.

## Endpoints

- `GET /health`
- `POST /run?action=create`
- `POST /run?action=accept`

## Race Testing

Use multiple Workers to verify concurrent acceptance behavior:

- Fund each bot wallet.
- Point every bot to the same canister and service binding.
- Ensure the market has at least one valid offer.
- Tail all bot logs.
- Trigger `POST /run?action=accept` on each Worker at the same time.
- Confirm every bot selects the same offer ID and only one bot accepts it.
