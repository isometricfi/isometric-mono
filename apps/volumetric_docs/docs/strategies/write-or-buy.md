---
sidebar_position: 2
title: Write or Buy
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

Writers post offers at a strike, term, and premium. Buyers shop by strike and term, and the **lowest-priced matching offer fills first**. It's a best-price market: the cheapest writer wins the buyer.

This means:

- **As a writer**, you're competing on price. The write flow shows your offer's competitiveness against other open offers at the same (strike, term). Undercut to fill faster; hold higher to earn more per fill, if it fills at all.
- **As a buyer**, you're not negotiating. You take the best offer the market currently has at the (strike, term) you want.

When buyer demand piles up, writers can hold higher premiums. When writers crowd in, premiums get bid down and buyers get better leverage at the same strike and term.

## Pick a side from your view

- **Bullish, expecting a sharp move.** Buy. Pick a strike beyond where you think BTC ends up, size it to what you can afford to lose.
- **Sideways or mildly bullish.** Write. Pick a strike above where you think BTC ends up, earn premium while still holding BTC.
- **Bearish or quiet.** Writing far-OTM (high strike) earns yield as long as BTC doesn't run up past it. You're being paid for the move you don't think is coming.
- **No strong view.** Sit it out. Premiums and leverage both reward conviction.

Most active users do both, switching sides as their read on the market changes.
