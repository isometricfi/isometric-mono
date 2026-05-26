# Isometric monorepo

Isometric runs decentralized BTC/USD call options on the Internet Computer: writers post ckBTC collateral, buyers pay premium in ckBTC, and settlement uses an on-chain oracle. Product mechanics and math live in [docs/product-overview.md](docs/product-overview.md).

## Layout

| Path | Role |
|------|------|
| `apps/volumetric_web` | Next.js app (wallet via Dynamic, Cloudflare Workers deployment) |
| `apps/volumetric_canister` | Rust canister (`make` targets in that directory) |
| `apps/volumetric_docs` | Docusaurus docs site |
| `apps/volumetric-bot` | Bot / automation tooling |
| `packages/canister-types` | Generated Candid bindings for TypeScript |
| `packages/telemetry` | Shared OpenTelemetry helpers |

## Prerequisites

- **pnpm** — version pinned in root `package.json` (`packageManager` field). Run `corepack enable` if your shell does not pick it up.
- **Node.js** — use an LTS release compatible with Next.js in `apps/volumetric_web`.

Canister work needs `dfx`, Rust with `wasm32-unknown-unknown`, and the tooling listed in [apps/volumetric_canister/README.md](apps/volumetric_canister/README.md).

## Root commands

Install dependencies from the repo root:

```bash
pnpm install
```

| Script | What it runs |
|--------|----------------|
| `pnpm dev` | Turborepo `dev` across workspaces |
| `pnpm build` | Turborepo `build` |
| `pnpm test` | Turborepo `test` |
| `pnpm lint` | Biome check |
| `pnpm format` | Biome format write |

The web app dev server uses port **4200** (`pnpm dev` filters through Turbo; run `pnpm --filter @volumetric/web dev` if you only want the frontend).

## Contributing

Conventions, commits, and stack notes are in [AGENTS.md](AGENTS.md). After changing the canister API, run `make generate` from `apps/volumetric_canister` (see that Makefile for full targets).
