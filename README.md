# Volumetric MVP

> **Diagram Link:** [Dynamic.xyz](https://www.dynamic.xyz/) - wallet adapter

## 1. Product Summary

Build a decentralized options trading MVP on ICP using ckAssets for collateral and payouts:

- Start with **BTC/USD call options** using ckBTC as the underlying/collateral unit
- Price reference uses an **ICP BTC/USD oracle** for settlement
- Design is **asset-generic** so you can later add ckETH, ckUSDC/ckUSDT, etc.
- Use **standardized contracts** (fixed expiries / strike increments / premium increments) to keep the market liquid, UX simple, and to enable partial fills across multiple writers

## 2. Core Concepts

### Covered Call (Phase 1)

- **Writer** deposits ckBTC as collateral
- **Buyer** pays a premium (in ckBTC)
- At expiry, if ITM, buyer receives the profit payout; writer's collateral is debited accordingly
- **No physical delivery/trading workflow** required; this is net-settled on-chain

### Put Options (Planned)

- Same matching + standardization framework
- Typically **stablecoin-collateralized** (e.g., writer deposits ckUSDC/ckUSDT), with payout logic based on BTC/USD at expiry

## 3. System Components

### A) Collateral & Escrow (ckAssets)

- All funds live as **ckAssets** inside canisters (escrow canister)
- Writer must deposit collateral to create sell liquidity (sell calls / sell puts)
- Buyer deposits premium at purchase time into escrow; escrow releases premium to writer instantly

### B) Contract Standardization

Writers choose from a menu, not arbitrary free-form values:

- **Underlying:** initially ckBTC referenced against USD
- **Expiries:** e.g. 7d / 30d (later weekly/monthly ladders)
- **Strike grid:** e.g. $500 or $1,000 steps (tunable)
- **Premium grid:** recommended to start with percentage steps like 0.5% increments (e.g. 0.5%, 1.0%, 1.5%, …) or a small curated set by expiry/strike distance
- **Min order size:** enforce a minimum like 0.0001 ckBTC (or equivalent) to avoid dust

This is the same "menu" idea that makes traditional options fungible and easy to fill from many writers.

### C) Oracle / Settlement Price

- Use an **ICP oracle feed** for BTC/USD at expiry
- Settlement uses a defined rule such as:
  ```
  settlement_price = oracle_price_at(expiry_timestamp)
  ```
  (or a TWAP window if you want to reduce manipulation later)

## 4. Trading & Settlement Logic

### Calls (ckBTC collateral)

**Variables:**

- `K` = strike (USD)
- `S` = settlement price (USD)
- `q` = size in BTC (e.g. 0.2 BTC)
- `Premium` = premium_rate × q (if premium is % of notional BTC size), paid at trade start

#### If Out-of-the-Money (S ≤ K):

- Option expires worthless
- Buyer loses premium
- Writer keeps premium and keeps collateral (unlocked)

#### If In-the-Money (S > K):

- Buyer payout represents intrinsic value
- If you want payout in ckBTC, you'll compute a BTC-denominated payout from the USD intrinsic value using S
- **Intrinsic USD value:** `(S - K) × q`
- **Payout in BTC (conceptually):** `((S - K) / S) × q`
- Escrow transfers payout ckBTC from locked collateral to buyer
- Writer keeps premium, loses payout amount from collateral

> **Note:** This "BTC-settled intrinsic" approach is the clean way to keep everything in ckBTC while referencing USD.

## 5. User Experience Flows

### Flow 1: Writer Lists a Call

1. Writer connects (ICP identity + wallet integration as you choose)
2. Deposits 1.0 ckBTC into platform
3. Selects from menus:
   - CALL, expiry=7d, strike=$60k, premium=1.0%
4. Chooses amount to offer into that bucket (e.g. "sell up to 1.0 BTC")
5. Listing becomes available for buyers to take (and can be partially filled)

### Flow 2: Buyer Buys a Call (Partial Fill)

1. Buyer browses buckets (tables by expiry → strike → premium)
2. Picks 7d / $60k / 1.0%
3. Enters size 0.30 BTC
4. Buyer pays premium immediately (e.g. 0.003 ckBTC if 1% of 0.30 BTC)
5. Platform allocates that 0.30 BTC exposure across one or more writers in the bucket
6. At expiry: automatic settlement using oracle

#### Outcome Example A (ITM)

- Strike `K=$60k`, expiry price `S=$72k`, size `q=0.30`
- Buyer payout in BTC: `((72k-60k)/72k) × 0.30 = (12/72) × 0.30 = 0.05 ckBTC`
- Buyer receives 0.05 ckBTC from collateral
- Writer keeps premium and loses 0.05 ckBTC from locked collateral

#### Outcome Example B (OTM)

- `K=$60k`, `S=$55k`, `q=0.30`
- Payout = 0
- Buyer loses premium
- Writer keeps premium; collateral unlocks

## 6. MVP Scope

### Included in MVP

- ✅ European covered **Calls only**, pair: BTC/USD, collateral in ckBTC
- ✅ Standard contract menus (expiry/strike/premium grids)
- ✅ Bucketed liquidity with partial fills from multiple writers
- ✅ Oracle-based settlement, single settlement snapshot rule
- ✅ Basic risk checks:
  - Writer must have enough free ckBTC to sell size
  - Min trade size
  - No under-collateralization

### Explicitly Not in MVP (future)

- ❌ Put options (stable collateral like ckUSDC/ckUSDT)
- ❌ Multiple assets (ckETH, etc.)
- ❌ Advanced pricing/IV modeling, RFQs, complex order types
- ❌ TWAP settlement (unless needed)
- ❌ Liquidations / margin (you're doing covered strategies first)

## 7. Expandability Notes

- **Asset-generic contract key** so adding ckETH later is mostly "configure menus + oracle feed"
- Starting with partial fills but **offer stitching** will be added later
- Add puts by switching collateral asset + payout math:
  - Put writers post ckUSDC/ckUSDT, and payouts occur in the stablecoin (or optionally in ckBTC using conversion rules)

## 8. Tech Stack

- **Frontend:** Next.js, Shadcn
- **Backend:** ICP Rust
- **Oracle:** ICP exchange rate canister
- **Wallet:** Dynamic.xyz for hot wallet integration
