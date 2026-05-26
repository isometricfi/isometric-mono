# volumetric_canister

Rust canister for the Isometric project on the Internet Computer.

## Prerequisites

- [dfx](https://internetcomputer.org/docs/current/developer-docs/setup/install) (IC SDK)
- Rust toolchain with `wasm32-unknown-unknown` target
- Docker (for reproducible builds)
- [candid-extractor](https://crates.io/crates/candid-extractor) - `cargo install candid-extractor`
- [ic-wasm](https://crates.io/crates/ic-wasm) - `cargo install ic-wasm`

## Quick start

```bash
make help        # Show all commands
make start       # Start local replica
make deploy TARGET=local  # Deploy locally
```

## Running locally

```bash
make start                # Start local replica
make deploy TARGET=local  # Deploy to local replica
make reinstall-local      # Wipe state and reinstall
```

Your canister will be available at `http://localhost:4943?canisterId={canister_id}`.

## Deploying to mainnet

For Orbit station setup, the WASM staging asset canister, CycleOps, and
governed deploy commands, see [`ORBIT.md`](ORBIT.md).

First, ensure you have an identity and cycles on the cycles ledger:

```bash
dfx identity whoami
dfx cycles balance --network ic
```

If you need cycles, convert ICP to cycles:

```bash
dfx cycles convert --amount 0.5 --network ic
```

Deploy:

```bash
make deploy TARGET=dev
```

Immediately after deploy, set and verify operational safeguards:

```bash
# Add a backup controller to avoid permanent lockout if one key is lost
make set-backup-controller TARGET=dev BACKUP_CONTROLLER=<backup-principal>

# Keep enough cycle reserve to reduce freeze risk (default here: 90 days)
make set-freezing-threshold TARGET=dev FREEZING_THRESHOLD_SECONDS=7776000

# Verify controllers, cycles balance, and freezing threshold
make status TARGET=dev
```

This will create a new canister and output its ID. Add the ID to `canister_ids.json`:

```json
{
  "volumetric_dev": {
    "ic": "<your-canister-id>"
  }
}
```

## Upgrading an existing canister

For reproducible deployments, use the Docker-built wasm:

```bash
make release                  # Build reproducible wasm
make deploy TARGET=dev        # Deploy volumetric.wasm
make verify                   # Confirm hashes match
```

Before and after each upgrade, run:

```bash
make status TARGET=dev
```

## Reinstalling (wiping state)

⚠️ **Warning**: This permanently deletes all canister state.

Local:

```bash
make reinstall-local
```

Mainnet:

```bash
dfx canister install volumetric_dev --network ic --mode reinstall --wasm volumetric.wasm
```

## Reproducible builds

Reproducible builds allow anyone to verify that the deployed canister matches the source code. See [ICP Reproducible Builds](https://internetcomputer.org/docs/building-apps/best-practices/reproducible-builds) for background.

### Build commands

| Command | Output | Purpose |
|---------|--------|---------|
| `make build` | `volumetric.wasm` | Local build with `--features testing`; Candid in `did/volumetric.testing.did` |
| `make release` | `volumetric.wasm` | Reproducible Docker build **without** testing; Candid in `did/volumetric.did` (production) |

`make verify-prod-wasm` checks that the production wasm exports **no** `testing_*` Candid methods.

**Testing-only canister methods** (whitelisted, only in the `make build` / `--features testing` wasm) are all named with a `testing_` prefix, e.g. `testing_set_oracle_price_cents`, `testing_reset_oracle`, `testing_force_settle`. See `did/volumetric.testing.did` for the full list; they are absent from `did/volumetric.did`.

### Build with Docker

```bash
make release
```

This:
1. Builds a Docker image with pinned versions of Ubuntu, Rust, and dfx
2. Compiles the canister with `--locked` to use exact dependency versions
3. Uses `--remap-path-prefix` for deterministic paths
4. Shrinks the Wasm with `ic-wasm`
5. Outputs `volumetric.wasm` in the project root

### Verify on-chain

Check the hash of the deployed canister:

```bash
make info
```

Compare to your local build:

```bash
make hash
```

Or run the verification script:

```bash
make verify
```

### Build environment

The Dockerfile (`docker/Dockerfile`) pins:
- Ubuntu 22.04 (linux/amd64)
- Rust 1.85.0
- dfx 0.29.2
- ic-wasm (for Wasm optimization)

Dependencies are locked via `Cargo.lock`. The build uses `RUSTFLAGS` with `--remap-path-prefix` to ensure deterministic output regardless of build machine paths.

## Admin commands

### Set trading limits

Update all trading limits at once. Query current values with `get_trading_limits` first, modify as needed:

```bash
# Get current limits
dfx canister call volumetric_dev get_trading_limits --network ic

# Set trading limits
dfx canister call volumetric_dev set_trading_limits --network ic '(record {
  quantity_sats = record { min = 90_000 : nat64; max = 100_000_000 : nat64 };
  premium_basis_points = record { min = 50 : nat16; max = 500 : nat16 };
  strike_basis_points = record { min = 500 : nat16; max = 2_000 : nat16 };
  option_duration_seconds = record { min = 60 : nat64; max = 2_592_000 : nat64 };
  deposit_amount_sats = 50_000 : nat64;
  withdraw_amount_sats = 50_000 : nat64;
})'
```

| Field | Description |
|-------|-------------|
| `quantity_sats` | Min/max offer size in satoshis |
| `premium_basis_points` | Min/max premium (100 = 1%) |
| `strike_basis_points` | Min/max strike price offset (100 = 1%) |
| `option_duration_seconds` | Min/max option duration (web UI derives term-day options from this range) |
| `deposit_amount_sats` | Minimum deposit amount |
| `withdraw_amount_sats` | Minimum withdrawal amount |

## Operations runbook

### Controller safety

- Always maintain at least two controllers for production canisters.
- Keep the backup controller key in separate custody from the primary deploy key.
- Re-verify controllers after each deploy or upgrade:

```bash
make status TARGET=dev
```

### Cycles and freezing-threshold monitoring

- Check canister status regularly and alert on low-cycle conditions:

```bash
make status TARGET=dev
```

- Recommended baseline:
  - Freezing threshold: at least `7776000` seconds (90 days) for production.
  - Alert when estimated runway is below your operational SLO.
- Top up before approaching freeze:

```bash
dfx cycles balance --network ic
dfx cycles convert --amount 0.5 --network ic
```

## Resources

- [Rust Canister Development Guide](https://internetcomputer.org/docs/current/developer-docs/backend/rust/)
- [ic-cdk](https://docs.rs/ic-cdk)
- [Candid Introduction](https://internetcomputer.org/docs/building-apps/interact-with-canisters/candid/candid-concepts)
- [Reproducible Builds](https://internetcomputer.org/docs/building-apps/best-practices/reproducible-builds)
