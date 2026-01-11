---
sidebar_position: 1
---

# System Architecture Overview

Isometric is built on the **Internet Computer Protocol (ICP)**, leveraging its unique capabilities for decentralized finance. This document provides a high-level overview of the system architecture.

## Architecture Diagram

```mermaid
graph TB
    User[User / Wallet] -->|Signs Messages| WebApp[Next.js Web App]
    WebApp -->|Agent-js Calls| Canister[Isometric Canister<br/>Rust Smart Contract]
    
    Canister -->|Deposit/Withdraw| ckBTC[ckBTC Ledger]
    Canister -->|Price Feed| Oracle[ICP Exchange Rate<br/>Canister]
    
    Canister -->|Stores| Storage[(Stable Storage<br/>Offers, Options,<br/>Balances, Events)]
    
    ckBTC -->|Bitcoin Network| BTC[Bitcoin Blockchain]
    Oracle -->|Aggregates| Exchanges[Exchange APIs<br/>Coinbase, Binance, etc.]
    
    style Canister fill:#f9f,stroke:#333,stroke-width:4px
    style Storage fill:#bbf,stroke:#333,stroke-width:2px
    style ckBTC fill:#ff9,stroke:#333,stroke-width:2px
    style Oracle fill:#9f9,stroke:#333,stroke-width:2px
```

## Core Components

### 1. Frontend (Next.js Web App)

**Technology**: Next.js, React, TypeScript, Shadcn UI

**Responsibilities**:
- User interface for trading options
- Wallet integration (Dynamic.xyz)
- Message signing for authentication
- Real-time price display
- Portfolio management UI

### 2. Backend (Isometric Canister)

**Technology**: Rust, IC CDK (Internet Computer Development Kit)

**Responsibilities**:
- Core business logic (offers, options, settlement)
- Authentication via BTC signature verification
- Balance management (deposits, withdrawals, transfers)
- Event logging and state management
- Automatic settlement via timers


### 3. ckBTC Ledger

**What is ckBTC?**

ckBTC (chain-key Bitcoin) is a **1:1 backed** Bitcoin token on ICP. It's created by depositing real BTC into a decentralized custody system and minting equivalent ckBTC on ICP.

**Why ckBTC?**
- **Fast**: Transactions settle in seconds, not minutes
- **Low fees**: Minimal transfer costs compared to Bitcoin L1
- **Decentralized**: No centralized custodian
- **1:1 backed**: Always redeemable for real BTC

**How Isometric Uses ckBTC**:
- All collateral is held as ckBTC
- All premiums are paid in ckBTC
- All payouts are in ckBTC
- Users deposit BTC → receive ckBTC → trade → withdraw ckBTC → receive BTC

### 4. ICP Exchange Rate Canister (Oracle)

**Purpose**: Provides BTC/USD price feeds for settlement

**How It Works**:
- Aggregates data from multiple exchanges (Coinbase, Binance, etc.)
- Provides median price to reduce manipulation risk
- Updates frequently (every few minutes)
- Accessible to all ICP canisters

**Isometric Integration**:
- Fetches BTC/USD price at option acceptance (for strike locking)
- Fetches BTC/USD price at expiry (for settlement)
- Used to calculate intrinsic value and payouts

**Learn more**: [ICP Exchange Rate Canister Docs](https://internetcomputer.org/current/developer-docs/integrations/exchange-rate-canister/)

## Data Flow

### Creating an Offer (Writer)

```mermaid
sequenceDiagram
    participant Writer
    participant WebApp
    participant Canister
    participant Storage
    
    Writer->>WebApp: Create offer (strike, premium, quantity)
    WebApp->>Writer: Generate signing message
    Writer->>WebApp: Sign message
    WebApp->>Canister: create_offer(signed payload)
    Canister->>Canister: Verify signature
    Canister->>Canister: Validate params & balance
    Canister->>Storage: Insert offer
    Canister->>Storage: Emit OfferCreated event
    Canister->>WebApp: Return offer details
    WebApp->>Writer: Show success
```

### Accepting an Offer (Buyer)

```mermaid
sequenceDiagram
    participant Buyer
    participant WebApp
    participant Canister
    participant Oracle
    participant ckBTC
    participant Writer
    
    Buyer->>WebApp: Accept offer
    WebApp->>Buyer: Generate signing message
    Buyer->>WebApp: Sign message
    WebApp->>Canister: accept_offers(signed payload)
    Canister->>Canister: Verify signature
    Canister->>Canister: Validate balance & params
    Canister->>Oracle: Get current BTC/USD price
    Oracle->>Canister: Return price (e.g., $100k)
    Canister->>Canister: Lock writer collateral
    Canister->>Canister: Debit buyer premium
    Canister->>ckBTC: Transfer premium to writer
    Canister->>ckBTC: Transfer fee to platform
    Canister->>Canister: Create active option
    Canister->>Canister: Emit OfferAccepted events
    Canister->>WebApp: Return active option
    WebApp->>Buyer: Show success
    WebApp->>Writer: Notify offer accepted
```

### Settlement at Expiry

```mermaid
sequenceDiagram
    participant Timer
    participant Canister
    participant Oracle
    participant Storage
    participant ckBTC
    
    Timer->>Canister: Trigger settlement (hourly)
    Canister->>Storage: Get expired options
    loop For each expired option
        Canister->>Oracle: Get BTC/USD price at expiry
        Oracle->>Canister: Return settlement price
        Canister->>Canister: Calculate payout (if ITM)
        alt Option is ITM
            Canister->>Canister: Unlock writer collateral
            Canister->>ckBTC: Transfer payout to buyer
            Canister->>ckBTC: Transfer profit fee to platform
            Canister->>Canister: Credit remaining to writer
        else Option is OTM
            Canister->>Canister: Unlock writer collateral
            Canister->>Canister: Credit full collateral to writer
        end
        Canister->>Storage: Mark option as settled
        Canister->>Storage: Emit OptionSettled events
    end
```

## Key Design Decisions

### 1. Covered Calls Only (MVP)

**Why?**
- Eliminates liquidation risk (no margin calls)
- Simpler to implement and understand
- No need for complex risk management
- Writers always have sufficient collateral

**Future**: Add cash-settled puts (stablecoin collateral)

### 2. Standardized Contracts

**Why?**
- Creates liquidity (multiple writers can fill same strike/expiry)
- Simplifies UX (no free-form inputs)
- Enables partial fills and offer stitching
- Reduces fragmentation

**How**: Fixed grids for strikes, premiums, and expiries

### 3. Automatic Settlement

**Why?**
- No manual exercise needed (better UX)
- Eliminates risk of forgetting to exercise
- Ensures timely settlement
- Reduces gas costs (batch settlement)

**How**: Hourly timer checks for expired options and settles them

### 4. BTC Signature Authentication

**Why?**
- No need for ICP identity management
- Users can use existing Bitcoin wallets
- Familiar UX for Bitcoin users
- Replay protection via nonces

**How**: Users sign messages with their Bitcoin private key, canister verifies signature

### 5. Subaccount-Based Balances

**Why?**
- Each user has isolated funds
- Platform cannot access user funds without signed approval
- Efficient on-chain accounting
- Supports fast internal transfers

**How**: Each user gets a unique subaccount derived from their principal

## Security Model

### Authentication

- **BTC signatures**: Users prove ownership of Bitcoin address
- **Nonce-based replay protection**: Each signature includes a nonce that increments
- **Challenge-response**: Canister generates challenge context (canister ID, network, nonce)

### Authorization

- **Whitelisting**: Optional whitelist for beta/controlled access
- **Controller-only endpoints**: Admin functions restricted to canister controllers
- **Balance checks**: All operations verify sufficient balance before execution

### Collateral Safety

- **Locked balances**: Collateral cannot be withdrawn while options are active
- **Atomic operations**: Accept and settlement are atomic (all-or-nothing)
- **Rollback on failure**: If any step fails, state is rolled back

### Oracle Trust

- **Decentralized oracle**: ICP exchange rate canister aggregates multiple sources
- **Median pricing**: Reduces manipulation risk
- **Transparent**: Oracle code is open-source and auditable

## Scalability

### Current Limits

- **Offers per term**: Writers can create a limited number of offers per strike/expiry combination
- **Batch settlement**: Options settle in batches (hourly) to reduce costs
- **Partial fills**: Enabled to improve liquidity

### Future Optimizations

- **Sharding**: Split storage across multiple canisters
- **Off-chain indexing**: Use indexers for historical data queries
- **Layer 2**: Explore L2 solutions for high-frequency trading

## Next Steps

Dive deeper into specific components:

- **[Collateral System](/architecture/collateral-system)** - How ckBTC balances work
- **[Contract Standardization](/architecture/contract-standardization)** - Strike/premium grids
- **[Settlement Process](/architecture/settlement)** - Automatic settlement details
- **[Authentication](/architecture/authentication)** - BTC signature verification
- **[Fee Structure](/architecture/fees)** - Platform fees and economics
