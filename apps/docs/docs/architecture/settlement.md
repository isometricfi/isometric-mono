---
sidebar_position: 4
---

# Settlement Process

Isometric uses **automatic settlement** powered by ICP timers and oracle price feeds. This document explains how settlement works.

## Overview

When options expire, the platform automatically:
1. Fetches the BTC/USD settlement price from the oracle
2. Calculates payouts for in-the-money options
3. Transfers funds to buyers and writers
4. Unlocks collateral
5. Emits settlement events

**No manual exercise required** - everything happens automatically.

## Settlement Timing

### Hourly Batch Settlement

A timer runs **every hour** to settle expired options:

```rust
fn setup_settlement_timer() {
    ic_cdk_timers::set_timer_interval(Duration::from_secs(3600), || {
        ic_cdk::spawn(async {
            let _ = settle_expired_options_use_case().await;
        });
    });
}
```

### Expiry Alignment

All options expire on **hour boundaries** (e.g., 14:00:00, 15:00:00).

**Why?**
- Efficient batch processing
- Predictable settlement times
- Reduces oracle query costs

## Oracle Integration

### ICP Exchange Rate Canister

Isometric uses the [ICP Exchange Rate Canister](https://internetcomputer.org/current/developer-docs/integrations/exchange-rate-canister/) for BTC/USD pricing.

**Features**:
- Aggregates data from multiple exchanges (Coinbase, Binance, etc.)
- Returns median price to reduce manipulation
- Updates every few minutes
- Free to query for ICP canisters

### Fetching Settlement Price

```rust
pub async fn get_btc_usd_price_cents() -> Result<u64> {
    let request = GetExchangeRateRequest {
        base_asset: Asset::BTC,
        quote_asset: Asset::USD,
        timestamp: None, // Use latest
    };
    
    let response = exchange_rate_canister.get_exchange_rate(request).await?;
    
    // Convert to cents (e.g., $100,000.00 = 10,000,000 cents)
    let price_cents = (response.rate * 100.0) as u64;
    
    Ok(price_cents)
}
```

## Settlement Logic

### Step 1: Find Expired Options

```rust
pub fn get_expired_options(now: u64) -> Vec<ActiveOption> {
    ACTIVE_OPTIONS.with(|options| {
        options.borrow()
            .iter()
            .filter(|(_, opt)| {
                opt.status == ActiveOptionStatus::Active && opt.expiry <= now
            })
            .map(|(_, opt)| opt.clone())
            .collect()
    })
}
```

### Step 2: Calculate Payout

For each expired option:

```rust
pub fn calculate_payout(
    quantity_sats: u64,
    settlement_price_cents: u64,
    strike_price_cents: u64,
) -> u64 {
    if settlement_price_cents <= strike_price_cents {
        // Out-of-the-money: no payout
        return 0;
    }
    
    // In-the-money: calculate intrinsic value in BTC
    let intrinsic_usd_cents = settlement_price_cents - strike_price_cents;
    
    // Convert to BTC: (intrinsic_usd / settlement_price) * quantity
    // Using integer math to avoid floating point
    let payout_sats = (intrinsic_usd_cents as u128 * quantity_sats as u128 
                      / settlement_price_cents as u128) as u64;
    
    payout_sats
}
```

**Example**:
- Quantity: 0.3 BTC (30,000,000 sats)
- Strike: $110,000 (11,000,000 cents)
- Settlement: $132,000 (13,200,000 cents)
- Intrinsic: $22,000 (2,200,000 cents)
- Payout: (2,200,000 / 13,200,000) × 30,000,000 = **5,000,000 sats (0.05 BTC)**

### Step 3: Transfer Funds

#### If Out-of-the-Money

```rust
// Unlock writer collateral
unlock_collateral(option.writer, option.quantity)?;

// Credit full collateral back to writer
add_available(option.writer, option.quantity);

// Buyer gets nothing (already lost premium)
```

#### If In-the-Money

```rust
// Calculate payout and profit fee
let gross_payout = calculate_payout(...);
let profit_fee = (gross_payout * option.profit_fee_basis_points) / 10_000;
let net_payout = gross_payout - profit_fee;

// Unlock writer collateral
unlock_collateral(option.writer, option.quantity)?;

// Transfer net payout to buyer
add_available(option.buyer, net_payout);

// Transfer profit fee to platform
add_platform_fee(profit_fee);

// Return remaining collateral to writer
let remaining = option.quantity - gross_payout;
add_available(option.writer, remaining);
```

### Step 4: Update Option Status

```rust
option.status = ActiveOptionStatus::Settled;
update_active_option(option);
```

### Step 5: Emit Events

```rust
emit_event(
    option.buyer,
    EventType::OptionSettled,
    EventData::OptionSettled {
        option_id: option.id,
        settlement_price_cents,
        payout_sats: net_payout,
        role: TradeRole::Buyer,
    },
);

emit_event(
    option.writer,
    EventType::OptionSettled,
    EventData::OptionSettled {
        option_id: option.id,
        settlement_price_cents,
        payout_sats: gross_payout,
        role: TradeRole::Writer,
    },
);
```

## Error Handling

### Oracle Failures

If the oracle fails to return a price:

```rust
match get_btc_usd_price_cents().await {
    Ok(price) => {
        // Proceed with settlement
        settle_option(option, price)?;
    }
    Err(e) => {
        // Log error and retry next hour
        log_settlement_error(option.id, e);
        // Option remains active, will retry next settlement cycle
    }
}
```

### Partial Settlement

If some options settle successfully but others fail:

```rust
for option in expired_options {
    match settle_single_option(option).await {
        Ok(_) => {
            settled_count += 1;
        }
        Err(e) => {
            failed_count += 1;
            log_settlement_failure(option.id, e);
        }
    }
}
```

Each option settles independently - one failure doesn't block others.

## Settlement Journal

The platform maintains a **settlement journal** for debugging and auditing:

```rust
pub struct PendingSettlement {
    pub option_id: u64,
    pub buyer: Principal,
    pub writer: Principal,
    pub quantity: u64,
    pub strike_price_cents: u64,
    pub expiry: u64,
    pub phase: SettlementPhase,
    pub created_at: u64,
    pub error_message: Option<String>,
}

pub enum SettlementPhase {
    Created,
    PriceFetched,
    PayoutCalculated,
    FundsTransferred,
    Completed,
    Failed,
}
```

Admins can query:
- `get_pending_settlements()` - Settlements in progress
- `get_failed_settlements()` - Settlements that failed
- `get_settlement_by_id(option_id)` - Specific settlement details

## Manual Settlement

Admins can manually trigger settlement for a specific option:

```bash
dfx canister call isometric_dev settle_option_by_id --network ic '(123 : nat64)'
```

**Use cases**:
- Retry failed settlements
- Emergency settlement
- Testing

## Settlement Guarantees

### Atomicity

Each option settlement is **atomic**:
- Either fully settles or fully rolls back
- No partial state (e.g., payout transferred but collateral still locked)

### Idempotency

Settlement is **idempotent**:
- Settling the same option twice has no effect
- Status check prevents double-settlement

### Finality

Once settled, options **cannot be unsettled**:
- Status changes to `Settled`
- Funds are permanently transferred
- No reversal mechanism (by design)

## Next Steps

- **[Authentication](/architecture/authentication)** - BTC signature verification
- **[Fee Structure](/architecture/fees)** - Platform fees
- **[API Reference]()** - Settlement endpoints
