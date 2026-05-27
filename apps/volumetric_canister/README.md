# Isometric Canister

Rust canister for the Isometric protocol on the Internet Computer. It manages accounts, covered option offers, acceptance, settlement, balances, and protocol configuration.

Product mechanics and trading guides live at <https://docs.isometric.fi>.

## Prerequisites

- [dfx](https://internetcomputer.org/docs/current/developer-docs/setup/install)
- Rust with the `wasm32-unknown-unknown` target
- Docker for reproducible builds
- `candid-extractor`, installed with `cargo install candid-extractor`
- `ic-wasm`, installed with `cargo install ic-wasm`

## Quick Start

```bash
make start
make build
make deploy TARGET=local
```

The local replica listens on `http://localhost:4943`.

## Build

| Command | Description |
|---------|-------------|
| `make build` | Build local/testing wasm and write `did/volumetric.testing.did` |
| `make release` | Build production wasm with Docker and write `did/volumetric.did` |
| `make verify-prod-wasm` | Confirm production Candid has no `testing_*` methods |
| `make hash` | Print the local wasm hash |

`make build` enables testing-only methods for local and PocketIC tests. `make release` builds production wasm without those methods.

## Test

```bash
make test
make test-integration
make test-integration-fast
```

Integration tests use PocketIC and live under `src/volumetric/tests`. See [src/volumetric/tests/README.md](src/volumetric/tests/README.md).

## Generate Types

After changing the canister API, regenerate TypeScript bindings:

```bash
make generate
```

Generated files are copied into `../../packages/canister-types/src/generated`.

## Deploy

Local deploy:

```bash
make deploy TARGET=local
```

Mainnet targets use `TARGET=dev`, `TARGET=stage`, or `TARGET=prod`.

```bash
make release
make deploy TARGET=dev
```

Governed Orbit deployments use:

```bash
make orbit-deploy TARGET=stage
make orbit-deploy TARGET=prod
```

Orbit setup, WASM staging, and production deployment steps live in [ORBIT.md](ORBIT.md).

## Operations

Useful commands:

| Command | Description |
|---------|-------------|
| `make status TARGET=dev` | Show controllers, cycles, and freezing threshold |
| `make info TARGET=dev` | Show canister module information |
| `make verify` | Compare local and deployed wasm hashes |
| `make set-backup-controller TARGET=dev BACKUP_CONTROLLER=<principal>` | Add a backup controller |
| `make set-freezing-threshold TARGET=dev FREEZING_THRESHOLD_SECONDS=7776000` | Set freezing threshold |

Warning: `make reinstall-local` wipes local canister state.

## Resources

- [Rust Canister Development Guide](https://internetcomputer.org/docs/current/developer-docs/backend/rust/)
- [ic-cdk](https://docs.rs/ic-cdk)
- [Candid](https://internetcomputer.org/docs/building-apps/interact-with-canisters/candid/candid-concepts)
- [Reproducible Builds](https://internetcomputer.org/docs/building-apps/best-practices/reproducible-builds)
