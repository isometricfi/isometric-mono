---
sidebar_position: 1
slug: /
---

# Welcome to Isometric

**Isometric** is a decentralized options trading platform built on the [Internet Computer Protocol (ICP)](https://internetcomputer.org/). Trade Bitcoin options with transparent pricing, automatic settlement, and full on-chain execution.

## What is Isometric?

Isometric enables you to trade **options** on Bitcoin in a fully decentralized environment. Unlike traditional options platforms:

- **Decentralized**: All trades execute on-chain via ICP smart contracts
- **Transparent**: Verifiable settlement, and real-time oracle pricing
- **BTC-Native**: Collateral and payouts in Bitcoin
- **Automatic Settlement**: Options settle automatically at expiry
- **No Counterparty Risk**: Smart contracts hold collateral and enforce settlement

## Who is Isometric For?

### Option Writers (Sellers)

Earn premium income by writing covered calls on your Bitcoin holdings. Lock your BTC as collateral and collect premiums from buyers.

[Learn how to write options →](/quick-start/write)

### Option Buyers

Gain leveraged exposure to Bitcoin price movements by purchasing call options. Pay a premium upfront for the right to profit if BTC rises above the strike price.

[Learn how to buy options →](/quick-start/buy)

## Key Features

### Standardized Contracts

Options are standardized with fixed strike increments, premium levels, and expiry times. This creates deep liquidity and makes it easy to find counterparties.

### Covered Calls

The current version supports **covered call options** only. Writers must fully collateralize their positions with BTC. This eliminates liquidation risk and keeps the system simple.

### Automatic Settlement

When options expire, the platform automatically:
1. Fetches the BTC/USD price from the ICP oracle
2. Calculates payouts for in-the-money options
3. Transfers profits to buyers and returns collateral to writers

No manual exercise required.

## Getting Started

Ready to start trading? Follow these steps:

1. **[Set up your account](/quick-start/account-setup)** - Connect your wallet and deposit funds
2. **Choose your path**:
   - **Writers**: [Create your first offer](/quick-start/write)
   - **Buyers**: [Buy your first option](/quick-start/buy)
3. **[Manage your portfolio](/quick-start/portfolio)** - Track positions and withdraw funds

## New to Options?

If you're unfamiliar with options trading, start here:

[Options Basics](/concepts/options-basics) - Learn about calls, strikes, premiums, and payoffs

## Technical Documentation

Developers and advanced users can explore:

- **[System Architecture](/architecture/overview)** - How Isometric works under the hood
- **[Options Basics](/concepts/options-basics)** - Learn about calls, strikes, and payoffs
