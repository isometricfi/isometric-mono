---
sidebar_position: 1
title: Options explained
---

# Options explained

A call option is the right, but not the obligation, to profit if BTC rises above a chosen price by a chosen date.

Every option has two sides:

- The **buyer** pays an amount upfront. If BTC rises above the strike at expiry, the buyer receives the difference, in BTC. If BTC stays at or below strike, the buyer loses what they put in.
- The **writer** commits BTC and receives the buyer's payment. If BTC stays at or below strike, the writer keeps everything. If BTC rises above strike, the difference comes out of the writer's BTC.

Isometric supports calls only.

## Fully covered: what makes Isometric different

Most options venues run on margin. The seller posts a fraction of the position and gets liquidated if the price moves against them. That's not what happens here.

On Isometric, every option is **fully covered** by real BTC committed at the moment of acceptance. The writer's worst case is paying out the move above strike, capped at the BTC they put up. There are no margin calls, no liquidations, and no forced closes. Once an option is accepted, the outcome depends only on the closing price.

- Buyer can lose at most the amount put in.
- Writer can lose at most the BTC committed.

## A simple picture

A 1-week call at $110,000 strike, BTC at $100,000.

- BTC ends at $105,000 → option expires worthless. Buyer loses what they put in. Writer keeps everything.
- BTC ends at $115,000 → buyer receives $5,000 of BTC.
- BTC ends at $200,000 → buyer receives the full move above strike, capped at the writer's collateral.

The writer's outcome is the mirror. They keep the premium every time, and they pay from collateral only when BTC ends above strike.
