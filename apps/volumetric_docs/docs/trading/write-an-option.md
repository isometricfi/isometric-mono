---
sidebar_position: 2
title: Write an option
---

# Write an option

Writing earns you BTC upfront. You pick a price target BTC has to stay below over a chosen window. If BTC stays at or below that strike at expiry, you keep your full collateral and the premium. If BTC ends above, you pay the buyer the percentage by which BTC exceeded your strike, in BTC, out of your collateral.

In a sharp move (BTC running well past your strike), the worst case is losing the full collateral you committed. That outcome is rare but possible, and it's what you're getting paid the premium to take on.

## The write flow

The app walks you through four steps.

### 1. Pick when, and the price BTC should stay below

Choose a **term** and a **strike** (a percentage above the current BTC price).

The strike percentage is converted to a USD price the moment a buyer accepts, using the BTC/USD price at that moment.

Higher strikes are typically safer and earn less; lower strikes typically earn more but get hit more often. More on the trade-off in [Write or Buy](/strategies/write-or-buy).

### 2. Set the amount

Choose how much BTC to back the offer with. This is your maximum exposure.

Offers can be filled by multiple buyers. A 1 BTC offer might be split into two fills, with each fill paying you premium proportionally. You can cancel any unfilled portion at any time.

### 3. Set the premium

Pick the premium you want to charge as a percentage of the offer size. The app shows the equivalent APY and your offer's **competitiveness** against other open offers at the same strike and term.

Lower premiums fill faster. Higher premiums earn more per fill but may not fill at all.

### 4. Review and confirm

The review screen shows strike, term, amount, premium, APY, competitiveness, and the platform fee. Slide to confirm and sign in your wallet.

## Limits

- Minimum offer size: **0.0004 BTC** (40,000 sats).
- Maximum offer size: **1 BTC**.
- Up to 5 open offers per term.

## What happens next

Your offer goes live and appears in **Portfolio → Offers**. Creating the offer does **not** lock your BTC.

When a buyer accepts (in whole or in part):

- The accepted amount of your BTC moves from **available** to **locked**.
- Your premium credits to your **available** balance immediately.
- The accepted portion appears in **Portfolio → Active** as a written option. Any remaining unfilled portion stays in **Portfolio → Offers**.

At expiry, the option settles automatically.

- BTC closes **at or below** strike: your locked BTC unlocks. You keep the premium and the full collateral.
- BTC closes **above** strike: the buyer's profit is paid out from your locked BTC. Whatever's left unlocks back to you. You still keep the premium.

## Worked example

You write **1 BTC** at **+10% strike** for a **7-day term** with a **2% premium**. BTC is at $100,000 when a buyer accepts in full.

- Strike locks at $110,000.
- Your premium of 0.02 BTC credits immediately.
- 1 BTC moves into locked.

| BTC at expiry | % over strike | Your final position |
|---|---|---|
| $90,000 | n/a (under) | 1 BTC + 0.02 premium = **1.02 BTC** |
| $110,000 | 0% | 1 BTC + 0.02 premium = **1.02 BTC** |
| $111,100 | 1% | ~0.99 BTC + 0.02 premium = **~1.01 BTC** |
| $200,000 | 82% | ~0 BTC + 0.02 premium = **~0.02 BTC** |

The further BTC runs above strike, the more of your collateral the buyer takes. You always keep the premium.
