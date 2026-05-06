---
sidebar_position: 2
title: Write or Buy
description: Should you write or buy Bitcoin options on Isometric? Compare both sides of the trade, the payoff profile, and which strategy fits your view on BTC.
keywords: [write or buy options, Bitcoin options strategy, covered calls, leveraged BTC, BTC options payoff]
---

# Write or Buy

Every option has two sides. Same strike, same term, opposite views on where BTC ends up.

## What each side wants

|                | Buyer                               | Writer                                                                                 |
| -------------- | ----------------------------------- | -------------------------------------------------------------------------------------- |
| Cash flow      | Pays premium upfront                | Earns premium upfront                                                                  |
| Wants BTC to   | Run **above** strike before expiry  | Stay **at or below** strike at expiry                                                  |
| Best case      | Big move past strike → large payout | BTC stays under → keep collateral + premium                                            |
| Worst case     | Loses what they put in              | BTC runs far past strike → pays buyer from collateral, up to the full amount committed |
| What they pick | Strike, term, amount                | Strike, term, amount, premium                                                          |

Buyers get **leverage** as a result of what they pick. They don't dial it in directly. Writers set the **premium** themselves, then compete with other writers to fill.

## What moves the premium

The premium is what the market charges for the writer's risk. Three things push it up or down.

### 1. Strike

Strikes on Isometric are always **above** spot. BTC has to run up for the option to pay out. Distance from spot is the single biggest driver of price.

| Strike (vs spot) | Chance BTC reaches it | Writer's risk | Premium | Buyer's leverage |
| ---------------- | --------------------- | ------------- | ------- | ---------------- |
| Close (e.g. +5%) | High                  | High          | High    | Low              |
| Mid (e.g. +10%)  | Medium                | Medium        | Medium  | Medium           |
| Far (e.g. +20%)  | Low                   | Low           | Low     | High             |

The closer the strike sits to spot, the more often the writer ends up paying out, so writers charge more for it. That's also why leverage shrinks for the buyer: they're paying for something more likely to actually happen.

### 2. Term

More time = more chance BTC moves through the strike. Same strike, longer term, higher premium.

- **Short term** (1d): little room to move. Lower premium. Writers cycle through more offers; buyers get cheap shots that need a fast move.
- **Long term** (14d): lots of room. Higher premium. Writer locks collateral longer; buyer pays more for the runway.

### 3. Recent volatility

When BTC has been moving hard, every strike looks reachable. Premiums rise across the board. When things calm down, premiums compress. Writers earn more in volatile markets because the risk is genuinely higher.

## How offers fill

Writers post offers at a strike, term, and premium. Buyers shop by strike and term. For a given strike and term, offers are ranked in this order:

1. **Lowest premium first.** The cheapest writer wins.
2. **Oldest offer first** at the same premium (FIFO).
3. **Largest offer wins big buyers.** Each buyer fills from one offer at a time. If they need more size than the cheapest offer has, they skip it and take the next offer big enough, even if its premium is higher.

This means:

- **As a writer**, you compete on price first. The write flow shows your offer's competitiveness against other open offers at the same (strike, term). Undercut to fill faster, or hold a higher premium with a bigger offer to capture buyers who are too big for the cheapest offer.
- **As a buyer**, you're not negotiating. The app picks the cheapest offer that has enough size for what you're putting in.

When buyer demand piles up, writers can hold higher premiums. When writers crowd in, premiums get bid down and buyers get better leverage at the same strike and term.

## Pick a side from your view

- **Bullish, expecting a sharp move.** Buy. Pick a strike beyond where you think BTC ends up, size it to what you can afford to lose.
- **Sideways or mildly bullish.** Write. Pick a strike above where you think BTC ends up, earn premium while still holding BTC.
- **Bearish or quiet.** Writing far-OTM (high strike) earns yield as long as BTC doesn't run up past it. You're being paid for the move you don't think is coming.
- **No strong view.** Sit it out. Premiums and leverage both reward conviction.

Most active users do both, switching sides as their read on the market changes.
