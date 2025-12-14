# Options System

## Data Types

### Offer

An offer is a writer's intent to sell an option. No funds are locked until a buyer accepts.

```rust
Offer {
    id: u64,
    writer: Principal,
    option_type: Call | Put,
    strike_price: u64,
    premium_per_unit: u64,
    total_quantity: u64,
    remaining_quantity: u64,
    expiry: u64,
    status: Open | PartiallyFilled | Filled | Cancelled,
    created_at: u64,
}
```

### ActiveOption

Created when a buyer accepts an offer. Collateral is locked in an escrow subaccount.

```rust
ActiveOption {
    id: u64,
    offer_id: u64,
    option_type: Call | Put,
    buyer: Principal,
    writer: Principal,
    quantity: u64,
    strike_price: u64,
    premium_paid: u64,
    expiry: u64,
    status: Active | Exercised | Expired | Settled,
    accepted_at: u64,
}
```

## Fund Flows

```
Writer Subaccount ─────┬─────────────────────────────> Writer Subaccount
                       │                                     ▲
                       │ collateral                          │ premium
                       ▼                                     │
                Option Escrow                          Buyer Subaccount
                       │
                       │ settlement
                       ▼
              Winner's Subaccount
```

## Example Flows

### 1. Full Acceptance

Alice offers 0.1 BTC. Bob accepts all of it.

| Step | Action | Result |
|------|--------|--------|
| 1 | Alice: `create_offer(0.1 BTC)` | Offer #1 created, no funds moved |
| 2 | Bob: `accept_offer(#1, 0.1 BTC)` | Collateral: Alice → Escrow #1 |
| | | Premium: Bob → Alice |
| | | ActiveOption #1 created |

### 2. Partial Fills

Alice offers 1 BTC. Three buyers each take a piece.

| Step | Action | Offer Status | Active Options |
|------|--------|--------------|----------------|
| 1 | Alice: `create_offer(1 BTC)` | Open (1 BTC remaining) | - |
| 2 | Bob: `accept_offer(#1, 0.3 BTC)` | PartiallyFilled (0.7 BTC) | #1: Bob, 0.3 BTC |
| 3 | Carol: `accept_offer(#1, 0.5 BTC)` | PartiallyFilled (0.2 BTC) | #2: Carol, 0.5 BTC |
| 4 | Dave: `accept_offer(#1, 0.2 BTC)` | Filled (0 BTC) | #3: Dave, 0.2 BTC |

Result: 1 offer → 3 separate ActiveOptions, each with its own escrow.

### 3. Stitching

Bob wants 0.5 BTC but must combine multiple offers.

| Offer | Writer | Available |
|-------|--------|-----------|
| #1 | Alice | 0.2 BTC |
| #2 | Carol | 0.15 BTC |
| #3 | Dave | 0.25 BTC |

Bob makes three accepts:

```
accept_offer(#1, 0.2 BTC)   → ActiveOption #1 (Alice)
accept_offer(#2, 0.15 BTC)  → ActiveOption #2 (Carol)
accept_offer(#3, 0.15 BTC)  → ActiveOption #3 (Dave)
```

Result: Bob has 3 ActiveOptions totaling 0.5 BTC with different writers.

### 4. Auto-Cancel (Insufficient Balance)

Alice has 0.5 BTC but creates offers totaling 0.8 BTC.

| Step | Action | Alice Balance | Result |
|------|--------|---------------|--------|
| 1 | `create_offer(#1, 0.4 BTC)` | 0.5 BTC | Offer #1 Open |
| 2 | `create_offer(#2, 0.4 BTC)` | 0.5 BTC | Offer #2 Open |
| 3 | Bob: `accept_offer(#1, 0.4 BTC)` | 0.1 BTC + premium | Success |
| 4 | Carol: `accept_offer(#2, 0.4 BTC)` | 0.1 BTC | **Offer #2 auto-cancelled** |

### 5. Settlement

At expiry, call options are settled based on price vs strike.

**ITM (price > strike):**

```
Strike: $95k, Settlement: $100k
Collateral: 0.1 BTC (10M sats)

Profit = (100k - 95k) / 100k × 10M = 500k sats

Buyer receives: 500k sats
Writer receives: 9.5M sats
```

**OTM (price ≤ strike):**

```
Strike: $95k, Settlement: $90k
Collateral: 0.1 BTC (10M sats)

Writer receives: 10M sats (all collateral)
Buyer receives: nothing (already paid premium)
```
