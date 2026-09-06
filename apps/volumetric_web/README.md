# Isometric Web

Next.js demo app for Isometric. It uses an automatic demo account and keeps simulated trading state in the browser.

Product behavior belongs in the docs site: <https://legacy-docs.isometric.fi>.

## Setup

Install dependencies from the repository root:

```bash
pnpm install
```

Create local environment variables:

```bash
cp apps/volumetric_web/.env.example apps/volumetric_web/.env.local
```

Set `NEXT_PUBLIC_BASE_URL` for local app work. Cloudflare D1 is only needed for landing-page features such as the waitlist.

## Development

```bash
pnpm --filter @volumetric/web dev
```

Open <http://localhost:4200>.

## Commands

| Command | Description |
|---------|-------------|
| `pnpm --filter @volumetric/web dev` | Start the local Next.js server |
| `pnpm --filter @volumetric/web build` | Build the app |
| `pnpm --filter @volumetric/web test` | Run Vitest |
| `pnpm --filter @volumetric/web lint` | Run Biome checks |
| `pnpm --filter @volumetric/web cf:preview` | Build and preview through OpenNext Cloudflare |

## Deployment

Cloudflare deployment commands live in `package.json`:

```bash
pnpm --filter @volumetric/web cf:deploy-all:dev
pnpm --filter @volumetric/web cf:deploy-all:stage
pnpm --filter @volumetric/web cf:deploy-all:prod
```

Remote deploys require Cloudflare credentials and the environment variables configured in `wrangler.jsonc`.
