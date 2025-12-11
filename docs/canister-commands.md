# Canister Commands

## Reinstall (Wipes State)

Reinstall a canister on mainnet, wiping all state:

```bash
dfx canister install volumetric_dev --mode reinstall --network ic --wasm volumetric.wasm
```

This bypasses dfx's build step and uses the pre-built Docker wasm directly.
