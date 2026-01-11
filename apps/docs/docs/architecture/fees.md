---
sidebar_position: 6
---

# Fee Structure

Isometric charges minimal fees to sustain platform development and operations. This document explains the fee structure.

## Fee Types

### 1. Premium Fee

Charged when a buyer accepts an offer.

**Rate**: 5% of premium (configurable)

**Example**:
- Premium: 0.01 BTC
- Premium fee: 0.0005 BTC (5%)
- Writer receives: 0.0095 BTC
- Platform receives: 0.0005 BTC

**Who pays**: Buyer (included in total cost)

### 2. Profit Fee

Charged when an option expires in-the-money.

**Rate**: 20% of buyer's profit (configurable)

**Example**:
- Gross payout: 0.05 BTC
- Profit fee: 0.01 BTC (20%)
- Buyer receives: 0.04 BTC
- Platform receives: 0.01 BTC

**Who pays**: Buyer (deducted from payout)

### 3. ckBTC Transfer Fees

Charged by the ckBTC ledger for on-chain transfers.

**Rate**: ~0.0000001 BTC per transfer

**When charged**:
- Premium transfer (buyer → writer)
- Premium fee transfer (buyer → platform)
- Withdrawal (user → external address)

**Who pays**: User initiating the transfer

## Fee Configuration

Platform administrators can adjust fee rates:

**Premium fee**: Percentage of premium charged to buyers (default: 5%)
**Profit fee**: Percentage of profits charged to buyers on ITM options (default: 20%)

Fees are configurable to balance platform sustainability with competitive pricing.

## Total Cost Examples

### For Buyers

**Scenario**: Buy 0.5 BTC call option at 1% premium

- Premium: 0.005 BTC
- Premium fee (5%): 0.00025 BTC
- Transfer fees: ~0.0000002 BTC
- **Total cost**: ~0.00525 BTC

**At settlement** (if ITM):
- Gross payout: 0.08 BTC
- Profit fee (20%): 0.016 BTC
- **Net payout**: 0.064 BTC

**Net profit**: 0.064 - 0.00525 = **0.05875 BTC**

### For Writers

**Scenario**: Write 0.5 BTC call option at 1% premium

- Premium earned: 0.005 BTC
- Premium fee (5%): -0.00025 BTC
- **Net premium**: 0.00475 BTC

**At settlement** (if OTM):
- Collateral returned: 0.5 BTC
- **Total**: 0.50475 BTC (original + premium)

**At settlement** (if ITM):
- Payout to buyer: 0.08 BTC
- Remaining collateral: 0.42 BTC
- **Total**: 0.42475 BTC (remaining + premium)

## Next Steps

- **[Authentication](/architecture/authentication)** - BTC signature verification
- **[Settlement Process](/architecture/settlement)** - Automatic settlement details
