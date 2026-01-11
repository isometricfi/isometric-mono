---
sidebar_position: 3
---

# Write

The **Write** page allows you to earn premium income by offering covered calls on your Bitcoin holdings.


## What is Writing a Covered Call?

When you **write a covered call**, you:

1. **Lock BTC as collateral** - Your BTC is held by the smart contract
2. **Set your terms** - Choose strike price, premium, and expiry
3. **Earn premiums** - Buyers pay you upfront to accept your offer
4. **Keep collateral if OTM** - If Bitcoin stays below the strike price at expiry, you keep your collateral AND the premium

### Simple Example

- You lock **0.1 BTC** as collateral
- You offer a call option with:
  - **Strike**: 10% above current BTC price (e.g., $110k if BTC is at $100k)
  - **Premium**: 1% (0.001 BTC)
  - **Expiry**: 7 days
- A buyer accepts and pays you **0.001 BTC** immediately
- **At expiry**:
  - If BTC is **below $110k**: You keep your 0.1 BTC + 0.001 BTC premium ✅
  - If BTC is **above $110k**: Buyer gets a payout from your collateral, you keep the premium

:::tip
Writing covered calls is a way to earn income on BTC you're holding anyway. It works best when you expect BTC to stay relatively flat or rise moderately.
:::

## Prerequisites

- [Account created and funded](/quick-start/account-setup)
- Sufficient **available balance** to cover the collateral amount

## Step 1: Navigate to Write Options

1. Go to the Isometric web app
2. Click **"Write Options"** or **"Sell"** in the navigation
3. You'll see the option creation form

## Step 2: Choose Your Parameters

You'll select from **standardized menus** (not free-form inputs). This ensures liquidity and makes it easy for buyers to find your offers.

### Asset

Currently, only **BTC/USD call options** are supported.

### Strike Price

The strike price is expressed as a **percentage above the current BTC price**.

**Available strikes** (example):
- +5% (slightly out-of-the-money)
- +10% (moderately out-of-the-money)
- +15% (further out-of-the-money)

**Higher strikes** = less likely to be exercised = lower premiums but safer for you

:::info How Strike Locking Works
The strike price in USD is **locked when a buyer accepts your offer**, not when you create it. If BTC is $100k when the buyer accepts and you chose +10%, the strike locks at $110k.
:::

### Premium

The premium is what buyers pay you upfront, expressed as a **percentage of the collateral amount**.

**Available premiums** (example):
- 0.5% (lower premium, easier to attract buyers)
- 1.0%
- 2.0%
- 5.0% (higher premium, harder to attract buyers)

**Higher premiums** = more income for you, but buyers may prefer cheaper offers

### Expiry / Duration

Choose how long the option lasts:

**Available durations** (example):
- 1 day
- 7 days
- 14 days

**Longer durations** = more time for BTC to move, typically command higher premiums

### Quantity

How much BTC you want to lock as collateral (in satoshis or BTC).

**Minimum**: Set by platform (e.g., 0.005 BTC)
**Maximum**: Your available balance

:::warning
Once you create an offer, your collateral is NOT locked yet. It only locks when a buyer accepts. However, you must have sufficient available balance.
:::

## Step 3: Sign and Submit

1. Click **"Create Offer"**
2. Review the signature message in your wallet
3. Sign the transaction
4. Your offer is now live!

## Step 4: Wait for Buyers

Your offer will appear in the **Open Offers** list for buyers to browse.

### What Happens When a Buyer Accepts?

1. **Collateral is locked** - Your BTC moves from "available" to "locked"
2. **Premium is paid** - You receive the premium immediately (minus a small platform fee)
3. **Active option created** - The option is now active and will settle at expiry

### Partial Fills

Buyers can accept **part of your offer** if partial fills are enabled. For example:
- You offer 1.0 BTC
- Buyer accepts 0.3 BTC
- Your offer remains open for the remaining 0.7 BTC

## Managing Your Offers

### View Your Offers

Go to **"My Offers"** to see:
- **Open**: Offers waiting for buyers
- **Partially Filled**: Offers with some quantity accepted
- **Filled**: Offers completely accepted
- **Cancelled**: Offers you cancelled

### Cancel an Offer

You can cancel an offer **before it's accepted**:

1. Go to **"My Offers"**
2. Find the offer you want to cancel
3. Click **"Cancel"**
4. Sign the cancellation message

:::info
You cannot cancel an offer after it's been accepted (even partially). Once accepted, the option must run until expiry.
:::

## At Expiry: What Happens?

The platform automatically settles your options:

### If Out-of-the-Money (BTC below strike)

- **You keep**: Your full collateral + the premium
- **Buyer gets**: Nothing (option expires worthless)
- **Your collateral unlocks**: Available for withdrawal or new offers

### If In-the-Money (BTC above strike)

- **You keep**: The premium
- **Buyer gets**: A payout from your collateral (the intrinsic value)
- **You keep**: Remaining collateral after payout

**Example:**
- Strike: $110k
- Expiry price: $132k
- Collateral: 0.3 BTC
- Payout to buyer: ~0.05 BTC (the intrinsic value in BTC terms)
- You keep: 0.25 BTC + premium

## Fees

- **Premium fee**: A percentage of the premium you earn (5%)

See [Fee Structure](/architecture/fees) for details.

## Tips for Successful Writing

1. **Start small** - Test with a small amount first
2. **Choose realistic strikes** - Too far OTM = low premiums, too close = high risk
3. **Monitor the market** - Adjust your offers based on BTC volatility
4. **Diversify expiries** - Don't put all collateral in one expiry
5. **Understand your risk** - You cap your upside at the strike price

**Learn more**: [Options Strategies →](/concepts/strategies)

## Next Steps

- **[Managing Your Portfolio](/quick-start/portfolio)** - Track your positions
- **[Options Basics](/concepts/options-basics)** - Deepen your understanding
- **[System Architecture](/architecture/overview)** - Learn how settlement works

---

## FAQ

### Can I withdraw my collateral before expiry?

No. Once an offer is accepted, your collateral is locked until expiry or settlement.

### What if no one accepts my offer?

Your offer will expire based on the "valid until" time you set. You can then create a new offer or adjust your terms.

### Can I edit an offer after creating it?

No. You must cancel the offer and create a new one with updated terms.

### What happens if the oracle fails?

Settlement is delayed until the oracle provides a valid price. Your collateral remains locked until settlement completes.
