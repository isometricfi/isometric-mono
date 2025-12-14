# Product Overview

## Summary

Volumetric is a decentralized options trading platform on ICP using ckAssets for collateral and payouts. The MVP focuses on BTC/USD call options using ckBTC as the underlying/collateral unit.

Key design principles:
- **Cash-settled**: No physical delivery, net-settled on-chain using oracle price
- **Asset-generic**: Architecture supports future assets (ckETH, ckUSDC, etc.)
- **Standardized contracts**: Fixed expiries, strike increments, and premium increments for liquidity and partial fills

## Core Concepts

### Covered Calls (Phase 1)

1. Writer deposits ckBTC as collateral
2. Buyer pays premium (in ckBTC)
3. At expiry, if ITM, buyer receives profit payout; writer's collateral is debited accordingly

### Put Options (Planned)

Same matching and standardization framework, but stablecoin-collateralized (ckUSDC/ckUSDT).

## Contract Standardization

Writers choose from a menu rather than arbitrary free-form values:

| Parameter | Options |
|-----------|---------|
| Underlying | ckBTC (referenced against USD) |
| Expiries | 7 days, 30 days (weekly/monthly ladders later) |
| Strike grid | $500 or $1,000 steps (tunable) |
| Premium grid | 0.5% increments (0.5%, 1.0%, 1.5%, ...) |
| Min order size | 0.0001 ckBTC |

This standardization makes options fungible and enables partial fills from multiple writers.

## Settlement Logic

### Variables

- **K** = Strike price (USD)
- **S** = Settlement price at expiry (USD)
- **q** = Option size (BTC)
- **Premium** = Upfront payment from buyer to writer (in BTC)

### Call Option Settlement

**Out-of-the-Money (S ≤ K):**
- Payout = 0
- Buyer loses premium
- Writer keeps premium, collateral unlocked

**In-the-Money (S > K):**
- USD intrinsic value: `(S - K) × q`
- BTC payout: `((S - K) / S) × q`
- Payout transferred from writer's collateral to buyer
- Writer keeps premium, loses payout amount from collateral

### Example

```
Strike K = $60,000
Settlement S = $72,000
Size q = 0.30 BTC
Premium = 1% = 0.003 BTC

Payout = ((72k - 60k) / 72k) × 0.30
       = (12,000 / 72,000) × 0.30
       = 0.05 BTC

Buyer receives: 0.05 BTC (paid 0.003 BTC premium)
Writer loses: 0.05 BTC from collateral (kept 0.003 BTC premium)
```

## MVP Scope

### Included

- European covered Calls only (BTC/USD, ckBTC collateral)
- Standard contract menus (expiry/strike/premium grids)
- Bucketed liquidity with partial fills from multiple writers
- Oracle-based settlement (single snapshot)
- Basic risk checks:
  - Writer must have enough free ckBTC
  - Minimum trade size enforced
  - No under-collateralization

### Not in MVP (Future)

- Put options (stable collateral)
- Multiple assets (ckETH, etc.)
- Advanced pricing/IV modeling, RFQs, complex order types
- TWAP settlement
- Liquidations / margin

## Tech Stack

- **Frontend**: Next.js with shadcn/ui
- **Backend**: ICP Rust canisters
- **Oracle**: ICP exchange rate canister
- **Wallet**: Dynamic.xyz for hot wallet integration
