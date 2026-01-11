---
sidebar_position: 5
---

# Architecture & Scope

## Tech Stack

- **Frontend**: Modern web framework with responsive UI
- **Backend**: Secure smart contracts on Internet Computer Protocol
- **Oracle**: Decentralized price feed aggregating multiple data sources
- **Wallet**: Bitcoin wallet integration for authentication

## MVP Scope

### Included in MVP (✅)

- European covered **Calls only**, pair: BTC/USD, collateral in ckBTC.
- Standard contract menus (expiry/strike/premium grids).
- Bucketed liquidity with partial fills from multiple writers.
- Oracle-based settlement, single settlement snapshot rule.
- Basic risk checks:
  - Writer must have enough free ckBTC to sell size.
  - Min trade size.
  - No under-collateralization.

### Explicitly Not in MVP (❌) - Future

- Put options (stable collateral like ckUSDC/ckUSDT).
- Multiple assets (ckETH, etc.).
- Advanced pricing/IV modeling, RFQs, complex order types.
- TWAP settlement (unless needed for anti-manipulation).
- Liquidations / margin (focused on covered strategies first).

## Expandability Notes

- **Asset-Generic Contract Key**: Adding ckETH later is mostly "configure menus + oracle feed".
- **Offer Stitching**: Starting with partial fills but offer stitching will be added later.
- **Puts Integration**: Add puts by switching collateral asset + payout math (payouts occur in stablecoin).
