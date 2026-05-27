# Isometric Canister Tests

PocketIC integration tests for the Isometric canister. The tests run real canister wasm in a simulated Internet Computer environment.

## Layout

Test entry points:

```text
tests/
├── e2e.rs
├── e2e/
│   ├── test_accounts.rs
│   ├── test_offers.rs
│   ├── test_accepts.rs
│   └── test_settlements.rs
└── integration_smoke.rs
```

Support modules:

```text
tests/
├── common/
│   ├── env.rs
│   ├── wallets.rs
│   ├── ledger.rs
│   ├── minter.rs
│   └── fixtures.rs
└── helpers/
    ├── accounts.rs
    ├── balances.rs
    ├── config.rs
    ├── offers.rs
    └── settlement.rs
```

## Coverage

| Component | Status |
|-----------|--------|
| Isometric canister | Real `volumetric.wasm` |
| ICRC-1 ledger | Official ledger wasm |
| Wallet signatures | Real BIP-137 signing |
| Balance sync | Ledger mint plus canister sync |
| Minter canister | Stub principal for tests that do not call minter methods |
| Bitcoin network | Not used in PocketIC tests |

## Run Tests

From `apps/volumetric_canister`:

```bash
make build
cargo test --test e2e
cargo test --test integration_smoke
```

Run a specific test:

```bash
cargo test --test e2e test_create_account -- --nocapture
```

## Test Style

Tests use given/when/then sections:

```rust
#[test]
fn test_example() {
    // given
    let env = create_test_env();
    whitelist_controller(&env);
    configure_test_ledger(&env);

    // when
    let result = create_offer(&env, &wallet, request);

    // then
    assert!(result.is_ok());
}
```

## Helpers

| Helper | Purpose |
|--------|---------|
| `create_test_env()` | Create PocketIC with Isometric and ledger canisters |
| `whitelist_controller(&env)` | Whitelist the test controller |
| `configure_test_ledger(&env)` | Point the canister to the test ledger |
| `generate_wallet(seed)` | Create a deterministic Bitcoin testnet4 wallet |
| `mint_and_sync_balance(&env, &profile, amount)` | Mint tokens and sync internal balance |
| `env.advance_time_secs(seconds)` | Advance simulated time |
| `set_oracle_price(&env, price_cents)` | Set testing oracle price through `testing_set_oracle_price_cents` |

Testing-only methods require wasm built with `--features testing`. See `did/volumetric.testing.did` for the testing interface.
