---
sidebar_position: 2
---

# Options Strategies

Learn how to use options effectively based on your market outlook and risk tolerance.

## Covered Call Strategy

Isometric uses **covered calls**, meaning writers must **fully collateralize** their positions with BTC.

### How It Works

1. **Writer deposits BTC** as collateral
2. **Buyer pays premium** to writer
3. **At expiry**:
   - If **OTM**: Writer keeps collateral + premium
   - If **ITM**: Buyer gets payout from writer's collateral

### Why "Covered"?

The writer's position is **covered** (backed) by actual BTC collateral. This eliminates:
- **Liquidation risk**: No margin calls
- **Counterparty risk**: Smart contract holds collateral
- **Infinite loss risk**: Writer's loss is capped at collateral amount

### Writer's Perspective

**Goal**: Earn premium income on BTC holdings

**Best case**: BTC stays below strike, keep collateral + premium

**Worst case**: BTC rises above strike, lose some collateral but keep premium

**Example:**
- Collateral: 1.0 BTC
- Strike: $110k (BTC currently $100k)
- Premium: 0.01 BTC
- **If BTC = $105k at expiry**: Keep 1.0 BTC + 0.01 BTC = **1.01 BTC** ✅
- **If BTC = $132k at expiry**: Lose ~0.167 BTC payout, keep 0.833 BTC + 0.01 BTC = **0.843 BTC**

### Buyer's Perspective

**Goal**: Leveraged exposure to BTC price increases

**Best case**: BTC rises far above strike, large payout

**Worst case**: BTC stays below strike, lose premium

**Example:**
- Premium: 0.01 BTC (~$1,000)
- Strike: $110k
- Quantity: 1.0 BTC
- **If BTC = $105k at expiry**: Lose 0.01 BTC ❌
- **If BTC = $132k at expiry**: Receive ~0.167 BTC (~$22,000), net profit ~$21,000 ✅

## Risk and Reward Profiles

### For Buyers

| Metric | Value |
|--------|-------|
| **Maximum Loss** | Premium paid |
| **Maximum Gain** | Unlimited (as BTC rises) |
| **Breakeven** | Strike + Premium (in USD terms) |
| **Risk Level** | Limited downside, unlimited upside |

**Key Takeaway**: Your risk is **always limited** to the premium you pay upfront.

### For Writers

| Metric | Value |
|--------|-------|
| **Maximum Loss** | Collateral - Premium (if BTC goes to infinity) |
| **Maximum Gain** | Premium earned |
| **Breakeven** | Strike price |
| **Risk Level** | Limited upside, significant downside |

**Key Takeaway**: You cap your upside at the premium but take on downside risk if BTC rises significantly.

## Payoff Diagrams

import PayoffChart from '@site/src/components/PayoffChart';

### Call Option Buyer Payoff

<PayoffChart 
  type="buyer" 
  strike={110000} 
  premium={1000}
  quantity={1.0}
  domain={[90000, 120000]} 
/>

**Key insights:**
- **Below strike ($110k)**: Lose premium (-100% ROI)
- **At strike**: Breakeven point (0% ROI)
- **Above strike**: Profit increases (e.g., at $120k = ~900% ROI)

### Call Option Writer Payoff

<PayoffChart 
  type="writer" 
  strike={110000} 
  premium={1000}
  quantity={1.0}
  domain={[90000, 120000]} 
/>

**Key insights:**
- **Below strike ($110k)**: Keep premium (~0.9% ROI on collateral)
- **At strike**: Breakeven point (0% ROI starts)
- **Above strike**: Loss increases as BTC rises
- **Maximum loss**: Capped at -100% (covered call)


## When to Use Options

### Buy Call Options When:

- You're **bullish** on BTC (expect price to rise)
- You want **leveraged exposure** without buying full BTC
- You want **limited downside** (only lose premium)
- You expect **high volatility** (big price moves)

### Write Call Options When:

- You're **neutral to slightly bullish** on BTC
- You want to **earn income** on BTC holdings
- You're willing to **cap your upside** at the strike price
- You expect **low volatility** (price stays relatively flat)

## Tips for Buyers

1. **Understand your max loss** - Never invest more than you can afford to lose
2. **Choose strikes carefully** - Higher strikes = lower premiums but need bigger BTC moves
3. **Consider time to expiry** - Longer expiries give BTC more time to move
4. **Watch volatility** - High volatility = higher premiums but more potential profit
5. **Don't panic** - Options can be worthless until the final hours before expiry

## Tips for Writers

1. **Start small** - Test with a small amount first
2. **Choose realistic strikes** - Too far OTM = low premiums, too close = high risk
3. **Monitor the market** - Adjust your offers based on BTC volatility
4. **Diversify expiries** - Don't put all collateral in one expiry
5. **Understand your risk** - You cap your upside at the strike price

## Common Misconceptions

### "Options are too risky"

**Reality**: For buyers, risk is **limited to the premium**. This can be less risky than buying BTC outright.

### "I need to exercise my option"

**Reality**: On Isometric, settlement is **automatic**. You don't need to do anything.

### "I can lose more than my premium as a buyer"

**Reality**: **False**. Buyers can never lose more than the premium paid.

### "Writers have unlimited risk"

**Reality**: On Isometric, writers use **covered calls**, so risk is limited to the collateral amount.

## Next Steps

- **[Options Basics](/concepts/options-basics)** - Learn key terms and concepts
- **[Write Options →](/quick-start/write)** - Start earning premiums
- **[Buy Options →](/quick-start/buy)** - Gain leveraged exposure

---

## Further Reading

- [Covered Call Strategy](https://www.investopedia.com/terms/c/coveredcall.asp)
- [Volatility and Options](https://www.investopedia.com/articles/optioninvestor/08/implied-volatility.asp)
