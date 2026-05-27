# Isometric

Isometric is an on-chain Bitcoin options protocol built on the Internet Computer. Writers post ckBTC collateral, buyers pay premiums in ckBTC, and options settle from an on-chain price source.

- App: <https://isometric.fi>
- Docs: <https://docs.isometric.fi>

## Repository

| Path | Description |
|------|-------------|
| `apps/volumetric_web` | Next.js web app deployed on Cloudflare Workers |
| `apps/volumetric_canister` | Rust Internet Computer canister |
| `apps/volumetric_docs` | Docusaurus docs site |
| `apps/volumetric-bot` | Automation bot for market operations and testing |
| `packages/canister-types` | Generated TypeScript bindings for canister calls |
| `packages/telemetry` | Shared OpenTelemetry helpers |

## Prerequisites

- Node.js 22 or newer
- pnpm 10.25.0, via `corepack enable`
- Rust, `dfx`, `candid-extractor`, and `ic-wasm` for canister work

The canister README has the full backend toolchain notes: [apps/volumetric_canister/README.md](apps/volumetric_canister/README.md).

## Quick Start

Install dependencies from the repository root:

```bash
pnpm install
```

Run the web app:

```bash
pnpm --filter @volumetric/web dev
```

The web app runs on <http://localhost:4200>. The docs site runs on <http://localhost:3333> with:

```bash
pnpm --filter volumetric_docs dev
```

## Commands

| Command | Description |
|---------|-------------|
| `pnpm dev` | Run workspace development tasks |
| `pnpm build` | Build workspaces with Turborepo |
| `pnpm test` | Run workspace tests |
| `pnpm lint` | Run Biome checks |
| `pnpm format` | Format files with Biome |

Run canister commands from `apps/volumetric_canister`:

```bash
make build
make test
make deploy TARGET=local
```

## Documentation

Product guides, trading mechanics, risk notes, and technical protocol docs live at <https://docs.isometric.fi>.

## Contributing

Open an issue before large changes. Keep pull requests focused and include tests for behavior changes.

After changing the canister API, run `make generate` from `apps/volumetric_canister` to update TypeScript bindings.

## License

See [LICENSE](LICENSE) for license terms.

## Disclaimer

This software is provided as-is. Isometric is experimental software and does not provide financial advice. Use it at your own risk.
