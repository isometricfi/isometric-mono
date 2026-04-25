---
sidebar_position: 5
title: FAQ
---

# FAQ

## Why is my deposit pending?

Bitcoin deposits require 4 network confirmations before they credit. This typically takes about 40 minutes. The deposit panel shows the live confirmation count.

## What's the minimum deposit?

**0.0005 BTC** (50,000 sats). Anything smaller will not credit.

## What's the minimum withdrawal?

**0.0005 BTC** (50,000 sats). The Bitcoin network fee is also deducted from the amount you withdraw.

## Does writing an offer lock my BTC?

No. Creating an offer doesn't reduce your available balance and doesn't lock anything. BTC only moves into a locked state when a buyer **accepts** your offer, in whole or in part. At that moment the accepted portion is locked and the premium credits to your available balance.

You can withdraw at any time, including while you have open offers.

## Why can't I withdraw all of my balance?

You can withdraw any amount up to **Available**. BTC sitting in **active options** (offers a buyer has accepted) is locked until expiry. The option will settle automatically and the BTC will unlock.

## What happens if I lose my wallet?

Your account is tied to your wallet. Without the wallet's keys, the account can't be accessed. Back up your wallet's seed phrase using your wallet's own backup process. Isometric does not custody your account.

## How is the BTC price determined at expiry?

Settlement uses an on-chain oracle that aggregates BTC/USD prices from multiple major exchanges. See [Price oracle](/technical/price-oracle).

## Can I exit a position early?

Buyers can't exit a bought option before expiry. The amount is paid upfront and the position runs to its term.

Writers can cancel any unfilled portion of an offer at any time. Already-accepted portions stay locked until expiry.

## Are there liquidations?

No. Every option is fully covered by BTC committed at acceptance. There are no margin calls and no forced closes.

## What's the maximum I can lose?

For a buyer, the maximum loss is exactly the amount you put in.

For a writer, the maximum loss is the amount BTC moves above your strike, capped at the BTC you committed. The writer keeps the premium in every case.

## What are the fees?

- **5%** of the premium when an offer is accepted (deducted from the writer's premium — you receive 95%).
- **20%** of the buyer's gross profit at settlement (only when the option is in the money — buyer receives 80%).

See [Fees](/trading/fees) for worked examples.

## What are the trading limits?

- Offer size: 0.0004 BTC to 1 BTC.
- Option purchase: 500 sats to 1 BTC.
- Term: 1 to 14 days.
- Strike: 2% to 15% above the current price.
- Premium (writer): 0.25% to 6% in 0.25% steps.
- Up to 5 open offers per term as a writer.

## Are puts supported?

Not yet. Only call options are available today. Puts are planned.

## Can I write an offer and have nobody accept it?

Yes. If your premium is too high or your strike is too aggressive, the offer may not fill. You can cancel and re-offer at any time. Unfilled offers cost nothing.

## What does the "competitiveness" score mean?

It's a comparison of your premium against other open offers at the same strike and term. Lower premiums rank higher (more attractive to buyers).

## Do I need KYC?

No. Isometric is permissionless. Connect a wallet, deposit BTC, trade.
