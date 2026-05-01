---
sidebar_position: 5
title: Settlement
description: How Bitcoin options settle on Isometric at expiry. Automatic on-chain payout, no signatures required, no exit timing, and how the settlement price is sourced.
keywords: [options settlement, BTC options expiry, on-chain settlement, automatic exercise]
---

# Settlement

At expiry, every option settles automatically. You don't sign anything and you don't trigger anything.

## What happens at expiry

The app reads the BTC/USD price from an on-chain oracle and compares it to the option's strike.

- **BTC at or below strike**: the writer's locked BTC unlocks back to their available balance. The buyer's option ends worthless.
- **BTC above strike**: the buyer's profit, in BTC, is calculated from how much BTC moved above strike. The platform deducts the profit fee. The buyer receives the net payout. The remainder of the writer's BTC unlocks.

The buyer's payout is capped at the writer's collateral. The writer can never lose more than the BTC they committed.

## What you'll see

- A position close to expiry shows a countdown in **Portfolio → Active**.
- Once expired, it shows **Expired: Now settling...** until the payout completes.
- Once settled, it disappears from Active and appears in **History** with the final result.
