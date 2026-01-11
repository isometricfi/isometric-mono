---
sidebar_position: 4
---

# Buy

The **Buy** page allows you to purchase call options to gain leveraged exposure to Bitcoin price movements.


## What is Buying a Call Option?

When you **buy a call option**, you:

1. **Pay a premium upfront** - This is the maximum you can lose
2. **Get the right to profit** - If BTC rises above the strike price
3. **Receive automatic payouts** - No manual exercise needed
4. **Risk only the premium** - Your downside is limited

### Simple Example

- BTC is currently at **$100,000**
- You buy a call option with:
  - **Strike**: $110,000 (10% above current price)
  - **Premium**: 0.003 BTC (~$300)
  - **Expiry**: 7 days
- **At expiry**:
  - If BTC is **$132,000**: You profit! You receive ~0.05 BTC (~$6,600) - your 0.003 BTC premium = ~$6,300 net profit ✅
  - If BTC is **$105,000**: Option expires worthless, you lose your 0.003 BTC premium ❌

:::tip
Buying call options is a way to get leveraged exposure to BTC without buying the full amount. Your risk is limited to the premium you pay.
:::

## Prerequisites

- [Account created and funded](/quick-start/account-setup)
- Sufficient **available balance** to cover the premium + transfer fees

## Step 1: Navigate to Buy Options

1. Go to the Isometric web app
2. Click **"Buy Options"** or **"Trade"** in the navigation
3. You'll see available offers from writers

## Step 2: Browse Available Offers

The platform shows you **open offers** grouped by:

- **Expiry** (e.g., 1 day, 7 days, 14 days)
- **Strike price** (e.g., +5%, +10%, +15% above current BTC price)
- **Premium** (e.g., 0.5%, 1%, 2%)

### Understanding the Offer Table

Each offer shows:

- **Writer**: Who's selling the option (anonymous principal ID)
- **Quantity Available**: How much BTC collateral is available
- **Strike**: The price BTC must exceed for you to profit (in % above current price)
- **Premium**: What you'll pay (in % of quantity)
- **Expiry**: When the option settles

:::info
The strike price in USD is **locked when you accept the offer**, based on the current BTC price at that moment. If BTC is $100k and you choose a +10% strike, it locks at $110k.
:::

## Step 3: Select an Offer

Click on an offer to see details and accept it.

### Choosing the Right Option

Consider:

1. **Strike price**: How much do you think BTC will rise?
   - **Lower strike** (+5%) = easier to profit, but higher premium
   - **Higher strike** (+15%) = cheaper premium, but BTC must rise more

2. **Expiry**: How long do you want exposure?
   - **Shorter** (1 day) = less time for BTC to move, cheaper premium
   - **Longer** (14 days) = more time for BTC to move, higher premium

3. **Premium**: How much are you willing to risk?
   - Remember: premium is your maximum loss

### Partial Fills

You can buy **part of an offer** if you don't want the full quantity:

- Writer offers: 1.0 BTC
- You buy: 0.2 BTC
- Remaining: 0.8 BTC stays available for other buyers

## Step 4: Enter Quantity

1. Enter how much BTC exposure you want (in satoshis or BTC)
2. The platform calculates:
   - **Premium you'll pay**
   - **Transfer fees** (small ckBTC network fee)
   - **Total cost**

:::warning Check Your Balance
Make sure your available balance covers the total cost (premium + fees).
:::

## Step 5: Review and Confirm

Before accepting:

- **Strike price** (in USD, locked at acceptance)
- **Premium** (what you pay now)
- **Expiry** (when settlement happens)
- **Maximum profit** (if BTC goes to infinity)
- **Maximum loss** (the premium)

## Step 6: Sign and Accept

1. Click **"Buy Option"** or **"Accept Offer"**
2. Review the signature message in your wallet
3. Sign the transaction
4. Your option is now active!

### What Happens Next?

1. **Premium is transferred** - From your balance to the writer (minus platform fee)
2. **Collateral is locked** - Writer's BTC is locked until expiry
3. **Active option created** - You can track it in your portfolio
4. **Automatic settlement** - At expiry, the platform settles automatically

## Managing Your Options

### View Your Active Options

Go to **"My Options"** or **"Portfolio"** to see:

- **Option ID**: Unique identifier
- **Strike price**: The price BTC must exceed
- **Entry price**: BTC price when you bought
- **Current BTC price**: Real-time price
- **Expiry**: When settlement happens
- **Status**: Active, Settled, etc.

### Can I Sell My Option Early?

**Not in the current MVP.** Options must be held until expiry. Secondary market trading may be added in the future.

## At Expiry: What Happens?

The platform automatically settles your options:

### If Out-of-the-Money (BTC below strike)

- **You get**: Nothing (option expires worthless)
- **You lose**: The premium you paid
- **Writer keeps**: Collateral + premium

**Example:**
- Strike: $110k
- Expiry price: $105k
- Your loss: Premium paid (e.g., 0.003 BTC)

### If In-the-Money (BTC above strike)

- **You get**: A payout equal to the intrinsic value
- **You profit**: Payout minus premium
- **Writer loses**: Payout amount from their collateral

**Example:**
- Strike: $110k
- Expiry price: $132k
- Quantity: 0.3 BTC
- **Intrinsic value**: `((132k - 110k) / 132k) × 0.3 = 0.05 BTC`
- **Your payout**: 0.05 BTC
- **Your profit**: 0.05 BTC - 0.003 BTC premium = 0.047 BTC (~$6,200)

:::tip
The payout is calculated in BTC terms, so you receive BTC, not USD. The formula converts the USD intrinsic value back to BTC using the settlement price.
:::

## Understanding Payoff

### Breakeven Point

Your **breakeven** is the strike price plus the cost of the premium (in USD terms).

**Example:**
- Strike: $110k
- Premium: 0.003 BTC (worth ~$300 at entry)
- Breakeven: ~$110,300

If BTC is above your breakeven at expiry, you profit.

### Maximum Profit

Theoretically **unlimited**. The higher BTC goes above the strike, the more you profit.

### Maximum Loss

**Limited to the premium** you paid. Even if BTC crashes to $0, you only lose the premium.

## Fees

When you buy options, you pay:

- **Premium** (to the writer)
- **Platform fee** (small % of premium, e.g., 5%)
- **Transfer fees** (ckBTC network fees for the transaction)

See [Fee Structure](/architecture/fees) for details.

## Tips for Successful Buying

1. **Start small** - Test with a small position first
2. **Don't over-leverage** - Only risk what you can afford to lose
3. **Choose realistic strikes** - Too far OTM = low probability of profit
4. **Monitor expiry** - Options settle automatically, no action needed
5. **Understand your max loss** - It's always the premium

**Learn more**: [Options Strategies →](/concepts/strategies)

## Next Steps

- **[Managing Your Portfolio](/quick-start/portfolio)** - Track your positions
- **[Options Basics](/concepts/options-basics)** - Deepen your understanding
- **[Settlement Process](/architecture/settlement)** - Learn how automatic settlement works

---

## FAQ

### Can I exercise my option early?

No. All options are **European-style**, meaning they can only be settled at expiry, not before.

### What if the oracle price is wrong?

The platform uses the ICP exchange rate canister, which aggregates data from multiple sources. If you believe there's an issue, you can raise it with the community, but settlements are final.

### Can I buy multiple options at once?

Yes! You can accept multiple offers in a single transaction (called "stitching"). This lets you build larger positions from multiple writers.

### What happens if I don't have enough balance?

The transaction will fail. Make sure your available balance covers the total cost (premium + fees) before accepting an offer.

### Do I need to do anything at expiry?

No. Settlement is **fully automatic**. If your option is ITM, you'll receive the payout automatically. If OTM, it expires worthless.
