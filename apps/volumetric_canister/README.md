# volumetric_canister

Rust canister for the Volumetric project on the Internet Computer.

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
| `make build` | `volumetric.local.wasm` | Fast local build (not reproducible) |
| `make release` | `volumetric.wasm` | Docker build (reproducible) |

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
  term_days = record { min = 1 : nat64; max = 14 : nat64 };
  deposit_amount_sats = 50_000 : nat64;
  withdraw_amount_sats = 50_000 : nat64;
})'
```

| Field | Description |
|-------|-------------|
| `quantity_sats` | Min/max offer size in satoshis |
| `premium_basis_points` | Min/max premium (100 = 1%) |
| `strike_basis_points` | Min/max strike price offset (100 = 1%) |
| `option_duration_seconds` | Min/max option duration |
| `term_days` | Min/max term length in days |
| `deposit_amount_sats` | Minimum deposit amount |
| `withdraw_amount_sats` | Minimum withdrawal amount |

## Resources

- [Rust Canister Development Guide](https://internetcomputer.org/docs/current/developer-docs/backend/rust/)
- [ic-cdk](https://docs.rs/ic-cdk)
- [Candid Introduction](https://internetcomputer.org/docs/building-apps/interact-with-canisters/candid/candid-concepts)
- [Reproducible Builds](https://internetcomputer.org/docs/building-apps/best-practices/reproducible-builds)
