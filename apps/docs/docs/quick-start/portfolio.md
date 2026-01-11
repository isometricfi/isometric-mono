---
sidebar_position: 5
---

# Portfolio

The **Portfolio** page allows you to track your positions, monitor performance, and withdraw funds.


## Accessing Your Portfolio

1. Navigate to **"Portfolio"** in the main menu
2. You'll see an overview of:
   - **Total Balance**
   - **Available Balance** (funds you can use)
   - **Locked Balance** (funds in active positions)
   - **Active Positions** (your current options)

## Understanding Your Balance

Your balance is split into different states:

### Available Balance

Funds you can use to:
- Write new options
- Buy new options
- Withdraw to your external wallet

### Locked Balance

Funds currently tied up in:
- **As Writer**: Collateral locked for options you've written
- **As Buyer**: (Minimal, since buyers pay premiums upfront)

:::info
Locked funds automatically become available again after options expire or settle.
:::

## Viewing Your Positions

### My Options (As Buyer)

Shows options you've **bought**:

- **Option ID**: Unique identifier
- **Strike Price**: Price BTC must exceed for profit
- **Entry Price**: BTC price when you bought
- **Current Price**: Real-time BTC price
- **Quantity**: Amount of BTC exposure
- **Premium Paid**: What you paid upfront
- **Expiry**: When settlement happens
- **Status**: Active, Settled, Expired
- **Current P&L**: Estimated profit/loss if settled now

### My Written Options (As Writer)

Shows options you've **written**:

- **Option ID**: Unique identifier
- **Strike Price**: Price BTC must stay below for max profit
- **Entry Price**: BTC price when buyer accepted
- **Current Price**: Real-time BTC price
- **Quantity**: Amount of BTC locked as collateral
- **Premium Earned**: What you received upfront
- **Expiry**: When settlement happens
- **Status**: Active, Settled, Expired
- **Locked Collateral**: Amount still locked

### My Offers (As Writer)

Shows your **open offers** waiting for buyers:

- **Offer ID**: Unique identifier
- **Strike %**: Strike as % above current price
- **Premium %**: Premium as % of quantity
- **Total Quantity**: Original offer size
- **Remaining Quantity**: Amount still available
- **Status**: Open, Partially Filled, Filled, Cancelled
- **Valid Until**: When the offer expires
- **Actions**: Cancel (if not yet accepted)

## Tracking Performance

### Profit & Loss (P&L)

For each position, you can see:

- **Unrealized P&L**: Estimated profit/loss if the option settled right now
- **Realized P&L**: Actual profit/loss after settlement

### As a Buyer

**Unrealized P&L** = Current intrinsic value - Premium paid

**Example:**
- Strike: $110k
- Current BTC: $120k
- Quantity: 0.2 BTC
- Premium paid: 0.002 BTC
- Current intrinsic value: `((120k - 110k) / 120k) × 0.2 = 0.0167 BTC`
- **Unrealized P&L**: 0.0167 - 0.002 = **+0.0147 BTC** ✅

### As a Writer

**Unrealized P&L** = Premium earned - Current intrinsic value owed

**Example:**
- Strike: $110k
- Current BTC: $120k
- Quantity: 0.2 BTC
- Premium earned: 0.002 BTC
- Current intrinsic value owed: 0.0167 BTC
- **Unrealized P&L**: 0.002 - 0.0167 = **-0.0147 BTC** ❌

:::tip
Unrealized P&L changes as BTC price moves. It's only an estimate until settlement.
:::

## Settlement History

View past settled options:

- **Settled Options**: Options that have expired
- **Settlement Price**: BTC price used for settlement
- **Payout**: Amount transferred (if ITM)
- **Final P&L**: Your actual profit or loss

## Withdrawing Funds

### Step 1: Ensure Sufficient Available Balance

You can only withdraw from your **available balance**. Locked funds cannot be withdrawn until positions settle.

### Step 2: Initiate Withdrawal

1. Go to **"Portfolio"** → **"Withdraw"**
2. Enter the amount to withdraw (in BTC or satoshis)
3. Enter your external Bitcoin address
4. Review the withdrawal details:
   - **Amount**: What you'll receive
   - **Fee**: Small ckBTC transfer fee
   - **Destination**: Your external address

:::warning Verify Address
Double-check your withdrawal address. Transactions are irreversible.
:::

### Step 3: Sign and Confirm

1. Click **"Withdraw"**
2. Sign the withdrawal message in your wallet
3. Confirm the transaction

### Step 4: Wait for Processing

- **On-chain processing**: A few seconds to minutes
- **Bitcoin network confirmations**: 10-60 minutes

Your funds will arrive at your external wallet once confirmed.

### Withdrawal Limits

- **Minimum withdrawal**: Set by platform configuration (e.g., 0.0005 BTC)
- **Maximum withdrawal**: Your available balance minus fees

## Monitoring Active Positions

### Real-Time Updates

The portfolio page updates in real-time:
- **BTC price**: Live oracle price
- **P&L**: Recalculated as price changes
- **Time to expiry**: Countdown to settlement

### Notifications (Future Feature)

In future versions, you may receive notifications for:
- Options nearing expiry
- Settlement completed
- Offers accepted

## Managing Offers

### Cancel an Open Offer

If you have an open offer that hasn't been accepted:

1. Go to **"My Offers"**
2. Find the offer
3. Click **"Cancel"**
4. Sign the cancellation message

Your offer is removed and you can create a new one.

:::info
You cannot cancel offers that have been partially or fully accepted.
:::

## Tips for Portfolio Management

1. **Monitor expiries** - Know when your positions settle
2. **Track P&L regularly** - Understand your exposure
3. **Don't over-commit** - Keep some available balance for new opportunities
4. **Withdraw profits** - Don't leave large amounts on the platform indefinitely
5. **Diversify expiries** - Spread risk across different time horizons

## Understanding Position States

### Active

Option is live and will settle at expiry.

### Pending Settlement

Option has expired and is waiting for automatic settlement.

### Settled

Option has been settled. Payouts (if any) have been distributed.

### Cancelled

Offer was cancelled before acceptance.

## Next Steps

- **[Options Basics](/concepts/options-basics)** - Deepen your understanding
- **[Settlement Process](/architecture/settlement)** - Learn how automatic settlement works
- **[Fee Structure](/architecture/fees)** - Understand platform fees

---

## FAQ

### Why is my balance locked?

Your balance is locked when:
- **As a writer**: You have active options with collateral locked
- **As a buyer**: (Rare, premiums are paid upfront)

Locked funds unlock automatically after settlement.

### Can I cancel an active option?

No. Once an option is active (offer accepted), it must run until expiry. You cannot cancel it.

### How long does withdrawal take?

- **Platform processing**: A few seconds
- **Bitcoin network**: 10-60 minutes (depends on network congestion)

### What if I want to close a position early?

The current MVP does not support early closing or secondary market trading. Options must be held until expiry.

### Where can I see my transaction history?

Go to **"Portfolio"** → **"History"** to see:
- Deposits
- Withdrawals
- Offers created
- Options bought/written
- Settlements
