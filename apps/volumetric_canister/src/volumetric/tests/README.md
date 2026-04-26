# Volumetric Canister Integration Tests

Integration tests using PocketIC to run real canister WASM in a simulated IC environment.

## Test Files (where `#[test]` functions live)

```
tests/
├── e2e.rs                      # Entry point for e2e tests
├── e2e/
│   ├── test_accounts.rs        # Account creation tests
│   ├── test_offers.rs          # Offer creation tests
│   ├── test_accepts.rs         # Offer acceptance tests
│   └── test_settlements.rs     # Settlement tests
└── integration_smoke.rs        # Basic infrastructure tests
```

## Support Files (helpers, no tests)

```
tests/
├── common/                 # Test infrastructure (PocketIC setup, utilities)
│   ├── env.rs              # TestEnv: creates PocketIC with volumetric + ledger canisters
│   ├── wallets.rs          # Bitcoin wallet generation and message signing
│   ├── ledger.rs           # ICRC-1 ledger helpers (mint, transfer, balance)
│   ├── minter.rs           # Mock UTXO helpers (unused)
│   └── fixtures.rs         # Test data constants
│
└── helpers/                # Domain-specific helpers (call canister endpoints)
    ├── accounts.rs         # create_account with wallet proof
    ├── balances.rs         # mint_and_sync_balance, get_user_balance
    ├── config.rs           # whitelist_controller, configure_test_ledger, set_oracle_price
    ├── offers.rs           # create_offer, accept_offers, get_open_offers
    └── settlement.rs       # get_pending_settlements, settle_option_by_id
```

## What's Real vs Mocked

| Component | Status | Notes |
|-----------|--------|-------|
| Volumetric canister | **Real WASM** | Your compiled `volumetric.wasm` |
| ICRC-1 Ledger | **Real WASM** | Official `ic-icrc1-ledger.wasm.gz` |
| Wallet signatures | **Real** | BIP-137 Bitcoin message signing |
| Balance sync | **Real** | Mints on ledger → canister reads ledger |
| Minter canister | **Stub** | Just a Principal ID, no WASM |
| Bitcoin/UTXOs | **Unused** | `minter.rs` has dead code |

## Running Tests

```bash
# Build canister first (required)
make build

# Run all e2e tests
cargo test --test e2e

# Run specific test module
cargo test --test e2e test_settlements

# Run single test with output
cargo test --test e2e test_create_account -- --nocapture

# Run smoke tests
cargo test --test integration_smoke
```

## Test Pattern

Tests follow given/when/then structure:

```rust
#[test]
fn test_example() {
    // given - setup environment and state
    let env = create_test_env();
    whitelist_controller(&env);
    configure_test_ledger(&env);
    
    let wallet = generate_wallet(100);
    let profile = create_account(&env, &wallet).expect("Account failed");
    mint_and_sync_balance(&env, &profile, 10_000_000).expect("Mint failed");

    // when - perform action
    let result = create_offer(&env, &wallet, ...);

    // then - assert outcomes
    assert!(result.is_ok());
}
```

## Key Helpers

### Environment Setup
- `create_test_env()` - Creates PocketIC with volumetric + ledger canisters
- `whitelist_controller(&env)` - Whitelists the test controller
- `configure_test_ledger(&env)` - Points canister to test ledger

### Wallet & Auth
- `generate_wallet(seed)` - Deterministic Bitcoin testnet4 wallet
- Helpers automatically sign messages with wallet proof

### Balances
- `mint_and_sync_balance(&env, &profile, amount)` - Mint tokens + sync internal state
- `get_user_balance(&env, &address)` - Query user's balance

### Time Control
- `env.advance_time_secs(seconds)` - Advance simulated time (triggers timers)

### Oracle
- `set_oracle_price(&env, price_cents)` - Calls the canister update **`testing_set_oracle_price_cents`** (requires a wasm built with `--features testing`; see `did/volumetric.testing.did` for the full testing-only Candid)
