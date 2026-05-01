---
sidebar_position: 1
title: Buy an option
description: Buy a Bitcoin call option on Isometric for leveraged BTC upside with capped downside. The buy flow, strike selection, and how max loss is limited to what you put in.
keywords: [buy Bitcoin options, BTC call options, leveraged BTC, Isometric buy flow, on-chain options]
---

# Buy an option

Buying gives you leveraged upside on BTC for a fixed period. Your maximum loss is exactly what you put in.

## The buy flow

The app walks you through three steps.

### 1. Pick when, and the price BTC should go above

Choose a **term** and a **strike** (a percentage above the current BTC price). The strike locks in USD the moment you confirm.

Higher strikes typically cost less and offer more leverage, because the chance of BTC reaching them is smaller. Lower strikes are more expensive but more likely to pay. More on the trade-off in [Write or Buy](/strategies/write-or-buy).

### 2. Choose how much to put in

Set the **amount** you want to put in. The app shows the resulting **leverage**.

The amount is your maximum loss. You can't lose more than this.

The app picks the best available offer matching your strike and term. You can take it in full or just a portion.

### 3. Review and confirm

The review screen shows strike, term, amount, leverage, max profit, and the platform fee on profit. Slide to confirm and sign in your wallet.

## What happens next

The option appears in your **Portfolio** under **Active**. At expiry it settles automatically.

Expiries land on the top of the hour. A 7-day term accepted at 12:01 expires at 13:00 seven days later.

- BTC closes **above** strike: profit settles to your account in BTC.
- BTC closes **at or below** strike: the option expires worthless. You lose what you put in.

You don't sign anything at expiry.

## Limits

Minimum purchase: **500 sats** (0.000005 BTC).

## Worked example

You put in **0.1 BTC** on a **7-day**, **+10% strike** call with BTC at $100,000. That's roughly **67x leverage** on what you put in.

- Strike locks at $110,000.
- Max loss: 0.1 BTC.
- Breakeven at expiry: $111,675.

| BTC at expiry | Outcome | Your net result |
|---|---|---|
| $95,000 | Expires worthless | **−0.1 BTC** |
| $111,675 | Breakeven | **0.00 BTC** |
| $115,000 | Pays out | **+0.19 BTC** |
| $130,000 | Pays out | **+0.93 BTC** |
| $200,000 | Large move, payout near max | **+2.9 BTC** |

The bigger the move above strike, the bigger your payout. Below strike, your loss is fixed at what you put in. Profits are subject to a [20% platform fee](/trading/fees).
