---
sidebar_position: 3
---

# Contract Standardization

Isometric uses **standardized contracts** to create deep liquidity and simplify the trading experience. This document explains how standardization works.

## Why Standardization?

Traditional options markets use standardized contracts for good reasons:

- **Liquidity**: Multiple writers can offer the same strike/expiry, creating deeper markets
- **Simplicity**: Traders choose from menus, not free-form inputs
- **Fungibility**: Options with same parameters are interchangeable
- **Partial Fills**: Buyers can fill from multiple writers in one transaction
- **Price Discovery**: Easier to compare offers when parameters are standardized

## Standardized Parameters

### 1. Asset

Currently: **BTC/USD call options only**

Future: ckETH, ckUSDC, ckUSDT, and other ckAssets

### 2. Strike Price (Basis Points)

Strikes are expressed as **basis points above current BTC price**.

**Available strikes** (configurable):
- 500 bps = +5%
- 1000 bps = +10%
- 1500 bps = +15%
- 2000 bps = +20%

**Example**:
- Current BTC: $100,000
- Strike: 1000 bps (+10%)
- Strike locks at: $110,000 when buyer accepts

**Key Point**: Strike in USD is **locked at acceptance time**, not offer creation time.

### 3. Premium (Basis Points)

Premiums are expressed as **basis points of the quantity**.

**Available premiums** (configurable):
- 50 bps = 0.5%
- 75 bps = 0.75%
- 100 bps = 1.0%
- 200 bps = 2.0%
- 500 bps = 5.0%

**Example**:
- Quantity: 1.0 BTC
- Premium: 100 bps (1%)
- Premium amount: 0.01 BTC

### 4. Option Duration (Seconds)

Durations are standardized in seconds.

**Available durations** (configurable):
- 86,400 seconds = 1 day
- 604,800 seconds = 7 days
- 1,209,600 seconds = 14 days

**Expiry Calculation**:
Options expire on **hour boundaries** for efficient batch settlement. Expiry times are automatically rounded up to the next hour mark to ensure all options expire at :00 minutes past the hour.

### 5. Quantity (Satoshis)

Minimum and maximum quantity limits:

**Minimum**: 90,000 sats (0.0009 BTC) - prevents dust
**Maximum**: 100,000,000 sats (1.0 BTC) - configurable

Quantities can be any value within this range (not standardized to specific increments).

## Trading Limits

The platform enforces configurable trading limits:

**Quantity limits**:
- Minimum: 90,000 sats (0.0009 BTC)
- Maximum: 100,000,000 sats (1.0 BTC)

**Premium limits**:
- Minimum: 50 basis points (0.5%)
- Maximum: 500 basis points (5%)

**Strike limits**:
- Minimum: 500 basis points (+5%)
- Maximum: 2,000 basis points (+20%)

**Duration limits**:
- Minimum: 86,400 seconds (1 day)
- Maximum: 1,209,600 seconds (14 days)

**Other limits**:
- Minimum deposit: 50,000 sats
- Minimum withdrawal: 50,000 sats
- Max offers per term: 3

### Max Offers Per Term

Writers can create a limited number of offers per strike/expiry combination.

**Example**:
- Strike: +10%
- Duration: 7 days
- Max offers: 3

A writer can create up to 3 different offers with these parameters (e.g., different premiums or quantities).

**Why?** Prevents spam and encourages consolidation of liquidity.

## Offer Stitching

**Offer stitching** allows buyers to accept multiple offers in a single transaction.

### How It Works

1. Buyer wants to buy 1.0 BTC of calls at +10% strike, 7-day expiry
2. Available offers:
   - Writer A: 0.3 BTC at 1% premium
   - Writer B: 0.5 BTC at 1% premium
   - Writer C: 0.4 BTC at 1.2% premium
3. Buyer accepts Writer A (0.3 BTC) + Writer B (0.5 BTC) + Writer C (0.2 BTC) = 1.0 BTC total
4. Platform creates 3 active options, grouped by a `fill_group_id`

**Benefits**:
- Buyers can build larger positions
- Writers don't need to offer huge amounts
- Liquidity is aggregated

**Requirements**:
- All offers must have same strike and expiry
- Stitching must be enabled in platform config

## Partial Fills

**Partial fills** allow buyers to accept part of an offer.

### Example

- Writer offers: 1.0 BTC at +10% strike, 1% premium
- Buyer accepts: 0.3 BTC
- Remaining: 0.7 BTC stays available for other buyers

**Offer Status Transitions**:
- `Open` → `PartiallyFilled` (after first partial fill)
- `PartiallyFilled` → `Filled` (when fully filled)

**Requirements**:
- Partial filling must be enabled in platform config
- Remaining quantity must meet minimum quantity requirement

## Bucketing and Liquidity

Standardization creates **buckets** of liquidity:

```
BTC/USD Calls
├── 7-day expiry
│   ├── +5% strike
│   │   ├── 0.5% premium: 2.5 BTC available (5 writers)
│   │   ├── 1.0% premium: 1.8 BTC available (3 writers)
│   │   └── 2.0% premium: 0.9 BTC available (2 writers)
│   ├── +10% strike
│   │   ├── 0.5% premium: 3.2 BTC available (6 writers)
│   │   └── 1.0% premium: 2.1 BTC available (4 writers)
│   └── +15% strike
│       └── 1.0% premium: 1.5 BTC available (3 writers)
└── 14-day expiry
    └── ...
```

Buyers can easily see total liquidity per bucket and choose the best option.

## Configuration Updates

Platform administrators can update trading limits and parameters to adjust the platform's risk profile and user experience as market conditions evolve.

## Future Enhancements

- **Dynamic grids**: Adjust strikes based on volatility
- **More expiries**: Add monthly, quarterly expiries
- **More assets**: ckETH, ckUSDC, ckUSDT
- **Put options**: Cash-settled puts with stablecoin collateral

## Next Steps

- **[Settlement Process](/architecture/settlement)** - How options settle
- **[Authentication](/architecture/authentication)** - BTC signature verification
- **[Fee Structure](/architecture/fees)** - Platform fees
