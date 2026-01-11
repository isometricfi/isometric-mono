---
sidebar_position: 2
---

# Collateral System

Isometric uses **ckBTC** (chain-key Bitcoin) for all collateral, premiums, and payouts. This document explains how the collateral system works.

## What is ckBTC?

**ckBTC** is a 1:1 Bitcoin-backed token on the Internet Computer Protocol (ICP).

- **1:1 backed**: Each ckBTC is backed by real BTC held in a decentralized custody system
- **Fast**: Transactions settle in ~2 seconds
- **Low fees**: Minimal transfer costs (~0.0000001 BTC per transfer)
- **Decentralized**: No single custodian controls the BTC
- **Redeemable**: Always convertible back to real BTC

Learn more: [ckBTC Documentation](https://internetcomputer.org/current/developer-docs/integrations/bitcoin/ckbtc)

## User Subaccounts

Each Isometric user has a **unique subaccount** within the Isometric canister.

### How Subaccounts Work

```
ckBTC Ledger
  └── Isometric Canister (owner)
        ├── User A Subaccount (derived from Principal A)
        ├── User B Subaccount (derived from Principal B)
        └── User C Subaccount (derived from Principal C)
```

**Key Points**:
- Subaccounts are **derived deterministically** from user principals
- Each subaccount is **isolated** - users cannot access each other's funds
- The canister can transfer between subaccounts **instantly** (no blockchain transaction)
- External transfers (deposits/withdrawals) require blockchain transactions

### Subaccount Security

Each user's subaccount is created using secure cryptographic methods.

This ensures:
- **Isolation**: Your funds are separate from other users
- **Consistency**: Your subaccount remains the same across sessions
- **Security**: Strong cryptographic protection

## Balance States

User balances are tracked in **three states**:

### 1. Available Balance

Funds you can use immediately for:
- Writing new options
- Buying new options
- Withdrawing to external wallet

### 2. Locked as Writer

Funds locked as collateral for options you've **written**.

- Locked when a buyer accepts your offer
- Cannot be withdrawn
- Unlocked at settlement (minus any payout if ITM)

### 3. Locked as Buyer

Funds locked for options you've **bought** (rare, since premiums are paid upfront).

- Typically zero for buyers
- May be used for future features (e.g., early closing)

### Balance Transitions

```mermaid
stateDiagram-v2
    [*] --> Available: Deposit
    Available --> LockedWriter: Offer Accepted
    Available --> [*]: Withdraw
    Available --> Available: Premium Received
    LockedWriter --> Available: Settlement (OTM)
    LockedWriter --> Available: Settlement (ITM, remaining)
```

## Deposit Flow

### Step 1: Get Deposit Address

User requests their unique deposit address from the platform.

The platform generates a Bitcoin address that:
- Is unique to the user
- Routes deposits to the user's ckBTC subaccount
- Can be used multiple times for deposits

### Step 2: Send BTC

User sends BTC from external wallet to this address.

### Step 3: ckBTC Minting

The ckBTC minter canister:
1. Detects the BTC deposit (monitors Bitcoin blockchain)
2. Waits for confirmations (typically 6)
3. Mints equivalent ckBTC to the user's subaccount

### Step 4: Update Balance

User requests a balance update to sync their internal balance with the ckBTC ledger:

1. Platform queries the ckBTC ledger for the user's subaccount balance
2. Internal balance tracking is updated to match
3. User can now use the deposited funds for trading

## Withdrawal Flow

### Step 1: Request Withdrawal

User requests to withdraw ckBTC to an external Bitcoin address:

1. Platform verifies the user's signature
2. Checks that sufficient available (non-locked) balance exists
3. Creates a pending withdrawal record
4. Deducts the amount from available balance

### Step 2: Process Withdrawal

A background process handles pending withdrawals:

1. Transfers ckBTC from user's subaccount to the ckBTC minter
2. Requests BTC redemption to the user's specified address
3. Marks withdrawal as complete

### Step 3: BTC Redemption

The ckBTC minter:
1. Burns the ckBTC
2. Sends equivalent BTC to the user's address
3. Waits for Bitcoin network confirmation

## Collateral Locking

When a buyer accepts an offer, the writer's collateral is locked.

### Lock Process

The platform atomically:
1. Verifies writer has sufficient available balance
2. Moves funds from "available" to "locked as writer" state
3. If insufficient balance, the entire operation fails

**Key Points**:
- Atomic operation (all-or-nothing)
- Fails if insufficient available balance
- Locked funds cannot be withdrawn

### Unlock Process (Settlement)

At settlement, the platform:

**If Out-of-the-Money**:
- Unlocks full collateral
- Returns all funds to writer's available balance

**If In-the-Money**:
- Calculates payout to buyer
- Transfers payout from locked collateral
- Returns remaining collateral to writer

## Premium Transfers

When a buyer accepts an offer, the premium is transferred immediately.

### Transfer Flow

The platform executes on-chain ckBTC transfers:

1. **Premium to writer**: Transfers premium (minus platform fee) from buyer's subaccount to writer's subaccount
2. **Fee to platform**: Transfers platform fee from buyer's subaccount to platform fee recipient

**Key Points**:
- Premium is paid **upfront** (not at settlement)
- Writer receives premium immediately (minus platform fee)
- Transfers are **on-chain** (ckBTC ledger transactions)

## Balance Tracking

The platform maintains accurate balance tracking for all users.

### Key Features

- **Real-time updates**: Your balance is always up to date
- **Atomic operations**: Balance changes happen all-at-once (no partial updates)
- **Audit trail**: All balance changes are recorded for transparency

## Security Considerations

### Balance Protection

The platform ensures your funds are always protected:

- **Pre-flight checks**: All operations verify you have sufficient balance before executing
- **Atomic operations**: Operations either complete fully or not at all (no partial failures)
- **Automatic rollback**: If any step fails, all changes are reversed to maintain consistency

### What This Means for You

- **No double-spending**: You cannot accidentally use the same funds twice
- **Guaranteed integrity**: Your balance is always accurate
- **Fail-safe protection**: Failed operations don't leave your account in an inconsistent state

## Next Steps

- **[Contract Standardization](/architecture/contract-standardization)** - How offers are structured
- **[Settlement Process](/architecture/settlement)** - Automatic settlement details
- **[Fee Structure](/architecture/fees)** - Platform fees
