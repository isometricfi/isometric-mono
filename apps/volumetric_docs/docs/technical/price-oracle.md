---
sidebar_position: 3
title: Price oracle
description: How Isometric prices BTC at settlement. The Internet Computer Exchange Rate Canister (XRC) provides the on-chain BTC/USD price used to settle every option.
keywords: [BTC price oracle, Exchange Rate Canister, XRC, on-chain price feed, Bitcoin oracle]
---

# Price oracle

When an option settles, the protocol uses a single BTC/USD price. That price comes from the Internet Computer's **Exchange Rate Canister (XRC)**, an on-chain price feed maintained as a system service.

## How the price is determined

The XRC pulls BTC/USD from multiple major exchanges and returns the median. The aggregation runs on-chain with consensus across many nodes, so the price every node agrees on is the price the protocol uses to settle.

A few properties make this hard to manipulate:

- **Multiple sources.** Moving the result would require moving the price on several venues at once.
- **Median, not mean.** A single outlier exchange can't shift the result.
- **On-chain with consensus.** Every node verifies the result. There is no admin who can override it after the fact.

Verify on-chain: [Exchange Rate Canister](https://dashboard.internetcomputer.org/canister/uf6dk-hyaaa-aaaaq-qaaaq-cai). Source: [dfinity/exchange-rate-canister](https://github.com/dfinity/exchange-rate-canister).
