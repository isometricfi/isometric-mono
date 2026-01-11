---
sidebar_position: 1
---

# Options Basics

New to options trading? This guide explains the fundamental concepts you need to understand before trading on Isometric.

## What Are Options?

An **option** is a financial contract that gives the buyer the **right, but not the obligation**, to buy or sell an asset at a predetermined price (the **strike price**) before or at a specific date (the **expiry**).

Think of it like an insurance policy or a reservation:
- You pay a small fee upfront (the **premium**)
- You get the right to do something later
- You're not forced to do it if it doesn't make sense

## Call Options Explained

Isometric currently supports **call options**, which give the buyer the right to profit if the underlying asset (Bitcoin) **rises above** the strike price.

### Key Players

1. **Option Writer (Seller)**
   - Locks collateral (BTC)
   - Receives premium upfront
   - Obligated to pay out if option expires in-the-money

2. **Option Buyer**
   - Pays premium upfront
   - Gets the right to profit if BTC rises
   - Risk limited to premium paid

### Simple Analogy

Imagine you want to buy a house that costs $500k today, but you're not sure if you'll have the money in 6 months.

You pay the seller $10k (premium) for the **right** to buy the house at $500k (strike price) anytime in the next 6 months (expiry).

**Scenario 1**: House price rises to $600k
- You exercise your right and buy at $500k
- You immediately sell at $600k
- **Profit**: $600k - $500k - $10k = **$90k**

**Scenario 2**: House price drops to $400k
- You don't exercise (why buy at $500k when market price is $400k?)
- You lose your $10k premium
- **Loss**: **$10k** (but you avoided buying a house worth $400k for $500k!)

This is exactly how call options work, but with Bitcoin instead of houses.

## Key Terms

### Strike Price

The **predetermined price** at which the option can be exercised.

- For **call options**: BTC must rise **above** the strike for the buyer to profit
- On Isometric: Strike is expressed as a **% above current BTC price** (e.g., +10%)
- Strike locks in USD when the buyer accepts the offer

**Example:**
- Current BTC price: $100,000
- Strike: +10% = $110,000
- If BTC reaches $120,000 at expiry, the option is profitable

### Premium

The **price you pay** to buy the option (or **earn** if you write it).

- Paid **upfront** by the buyer to the writer
- This is the buyer's **maximum loss**
- This is the writer's **guaranteed income**
- On Isometric: Premium is expressed as a **% of the quantity** (e.g., 1% of 0.1 BTC = 0.001 BTC)

**Example:**
- Quantity: 0.5 BTC
- Premium: 2%
- Premium paid: 0.5 × 0.02 = **0.01 BTC**

### Expiry

The **date and time** when the option settles.

- On Isometric: Options are **European-style**, meaning they settle **only at expiry**, not before
- Settlement is **automatic** - no manual action required
- Expiries are standardized (e.g., 1 day, 7 days, 14 days)

### Intrinsic Value

The **profit** the option would generate if exercised right now.

**For call options:**
- If BTC > Strike: Intrinsic value = BTC price - Strike price
- If BTC ≤ Strike: Intrinsic value = 0

**Example:**
- Strike: $110,000
- Current BTC: $120,000
- Intrinsic value: $120,000 - $110,000 = **$10,000** per BTC

On Isometric, intrinsic value is converted to BTC for payouts:
- Payout in BTC = `((BTC price - Strike) / BTC price) × Quantity`

## In-the-Money vs Out-of-the-Money

### In-the-Money (ITM)

An option is **in-the-money** when it has intrinsic value.

**For call options:**
- BTC price **>** Strike price
- Buyer profits
- Writer pays out from collateral

**Example:**
- Strike: $110k
- BTC at expiry: $130k
- Status: **ITM** ✅
- Buyer receives payout

### Out-of-the-Money (OTM)

An option is **out-of-the-money** when it has no intrinsic value.

**For call options:**
- BTC price **≤** Strike price
- Buyer loses premium
- Writer keeps collateral + premium

**Example:**
- Strike: $110k
- BTC at expiry: $105k
- Status: **OTM** ❌
- Option expires worthless

### At-the-Money (ATM)

An option is **at-the-money** when BTC price equals the strike price.

- Technically OTM (no intrinsic value)
- Rare in practice due to price volatility


## Next Steps

Now that you understand the basics:

- **[Write Options →](/quick-start/write)** - Start earning premiums
- **[Buy Options →](/quick-start/buy)** - Gain leveraged exposure
- **[System Architecture →](/architecture/overview)** - Learn how Isometric works

---

## Further Reading

- [Investopedia: Call Options](https://www.investopedia.com/terms/c/calloption.asp)
- [Covered Call Strategy](https://www.investopedia.com/terms/c/coveredcall.asp)
- [Options Greeks](https://www.investopedia.com/trading/getting-to-know-the-greeks/) (advanced)

## Next Steps

Now that you understand the basics:

- **[Options Strategies →](/concepts/strategies)** - Learn when and how to use options
- **[Write Options →](/quick-start/write)** - Start earning premiums
- **[Buy Options →](/quick-start/buy)** - Gain leveraged exposure
- **[System Architecture →](/architecture/overview)** - Learn how Isometric works

---

## Further Reading

- [Investopedia: Call Options](https://www.investopedia.com/terms/c/calloption.asp)
- [Options Greeks](https://www.investopedia.com/trading/getting-to-know-the-greeks/) (advanced)
