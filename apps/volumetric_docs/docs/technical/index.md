---
sidebar_position: 1
title: How Isometric uses ICP
description: How Isometric runs Bitcoin options on the Internet Computer. Threshold-ECDSA custody of native BTC, on-chain price oracle, and self-scheduled settlement with no off-chain server.
keywords: [Internet Computer Bitcoin, ICP Bitcoin options, threshold ECDSA, ckBTC, on-chain Bitcoin smart contracts]
---

# How Isometric uses ICP

Isometric runs as a smart contract on the Internet Computer. There is no off-chain server. The protocol holds BTC under threshold-ECDSA custody, prices it from an on-chain oracle, and settles options on a schedule it controls itself.

Three properties of the Internet Computer make this design possible:

1. **Threshold ECDSA.** Internet Computer nodes sign Bitcoin transactions collectively. No single node holds the key. This is what makes self-custody possible without a centralised bridge.
2. **HTTPS outcalls with consensus.** Smart contracts can fetch external data with the result agreed by multiple nodes. The protocol's BTC/USD oracle works this way.
3. **Self-scheduling smart contracts.** The protocol can schedule itself to run on a fixed interval, paid for by the protocol itself. Settlement runs automatically with no off-chain trigger and no operator in the loop.

## Where to next

- [Mechanics](./mechanics): what happens when an offer is accepted, and how options settle.
- [Price oracle](./price-oracle): how the BTC/USD price used at settlement is determined.
