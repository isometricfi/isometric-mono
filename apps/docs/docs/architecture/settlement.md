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

A background timer runs **every hour** to settle expired options automatically.

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

The platform queries the ICP Exchange Rate Canister for the current BTC/USD price:

1. Requests latest BTC/USD exchange rate
2. Receives median price from multiple exchanges
3. Converts to cents for precise calculations (e.g., $100,000.00 = 10,000,000 cents)

## Settlement Logic

### Step 1: Find Expired Options

The platform identifies all active options where the expiry time has passed.

### Step 2: Calculate Payout

For each expired option:

**If Out-of-the-Money** (settlement price ≤ strike price):
- No payout to buyer
- Full collateral returned to writer

**If In-the-Money** (settlement price > strike price):
- Calculate intrinsic value in USD
- Convert to BTC based on settlement price
- Deduct profit fee (paid by buyer)

**Example**:
- Quantity: 0.3 BTC (30,000,000 sats)
- Strike: $110,000
- Settlement: $132,000
- Intrinsic value: $22,000
- Payout: ~0.05 BTC (5,000,000 sats)

### Step 3: Transfer Funds

#### If Out-of-the-Money

1. Unlock writer's collateral
2. Credit full collateral back to writer's available balance
3. Buyer receives nothing (already paid premium upfront)

#### If In-the-Money

1. Calculate gross payout to buyer
2. Deduct profit fee from payout
3. Unlock writer's collateral
4. Transfer net payout to buyer's available balance
5. Transfer profit fee to platform
6. Return remaining collateral to writer's available balance

### Step 4: Update Option Status

The option is marked as settled in the platform's storage.

### Step 5: Emit Events

Settlement events are emitted for both buyer and writer, including:
- Option ID
- Settlement price
- Payout amount
- User's role (buyer or writer)

## Reliability

### Automatic Retry

The platform automatically handles settlement reliably:

- If settlement is temporarily delayed, the system will retry automatically
- Options remain protected until successfully settled
- You don't need to take any manual action

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
