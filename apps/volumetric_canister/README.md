# volumetric_canister

Rust canister for the Volumetric project on the Internet Computer.

## Prerequisites

- [dfx](https://internetcomputer.org/docs/current/developer-docs/setup/install) (IC SDK)
- Rust toolchain with `wasm32-unknown-unknown` target

## Running locally

```bash
# Start the local replica
dfx start --background

# Deploy to local replica
dfx deploy
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

Deploy a new canister:

```bash
dfx deploy --network ic
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

To upgrade a canister that's already deployed on mainnet:

```bash
dfx deploy --network ic
```

dfx reads the canister ID from `canister_ids.json` and performs an upgrade instead of a fresh install.

To explicitly upgrade:

```bash
dfx canister install volumetric_dev --network ic --mode upgrade
```

## Resources

- [Rust Canister Development Guide](https://internetcomputer.org/docs/current/developer-docs/backend/rust/)
- [ic-cdk](https://docs.rs/ic-cdk)
- [Candid Introduction](https://internetcomputer.org/docs/building-apps/interact-with-canisters/candid/candid-concepts)
