---
sidebar_position: 7
title: Risk
---

# Risk

What you can lose, and how. Read this before you trade.

## Buyer risk

Your maximum loss is **exactly what you put in**. If BTC ends at or below strike, the option expires worthless and you lose 100% of the amount you paid. There are no further obligations and no margin calls.

You can't exit a position early. Once you've bought, you're in until expiry.

## Writer risk

Your maximum loss is the **full BTC you committed**. If BTC runs far past your strike, the buyer's payout comes out of your collateral, capped at what you locked. Draining almost all of it takes an extreme move, roughly **80% past your strike**, which is historically rare. That tail risk is exactly what the premium is paying you to take on, and the premium is yours either way.

## Settlement price

Only the BTC/USD price **at expiry** counts. Mid-term moves don't settle anything: BTC can run past strike and pull back to expire worthless, or sit below all term and spike at the last minute to pay out. The price comes from an on-chain oracle aggregating major exchanges. See [Price oracle](/technical/price-oracle).

## Self-custody

Your account is tied to your wallet. **If you lose access to the wallet, you lose access to your funds.** Isometric does not custody your account, cannot reset it, and cannot recover it. Back up your seed phrase using your wallet's own process.

## Protocol risk

Isometric runs on smart contracts and a price oracle. As with any on-chain system, there is residual risk from contract bugs, oracle failure, or chain-level incidents. The protocol is fully covered (no leverage on the writer side, no margin calls), which removes one major class of failure, but does not eliminate technical risk. See [Technical](/technical/) for what's under the hood.

## What is _not_ a risk

- **Liquidations.** None. Every option is fully covered at acceptance.
- **Margin calls.** None. Your worst case is fixed at the moment you trade.
- **Counterparty default.** Collateral is locked at acceptance, not promised. The writer can't fail to deliver.
