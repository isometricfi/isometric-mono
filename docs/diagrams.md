# System Diagrams

## Account Creation/Deposit Flow

```mermaid
sequenceDiagram
    participant User as Buyer & Writer
    participant ckMinter as ckMinter<br/>(bridges btc both ways)
    participant NextApp as Next App
    participant Canister as Core Canister

    Note over User,Canister: Account Creation Flow

    User->>NextApp: Connect BTC wallet
    NextApp->>Canister: Request account creation
    Canister->>Canister: Generate message to approve
    Canister->>NextApp: Return signed message
    NextApp->>User: Gets message to sign
    User->>NextApp: Returns payment address signed message
    NextApp->>Canister: Return signed message
    Canister->>Canister: Create profile
    Canister->>NextApp: Return IC deposit address

    Note over User,Canister: Deposit Flow

    User->>NextApp: User requests deposit
    NextApp->>ckMinter: Calls minter with output IC addy
    ckMinter->>NextApp: returns BTC deposit addy
    NextApp->>User: Requests BTC transfer to Ck Deposit Addy
    User->>ckMinter: User Sends BTC to Minter
    NextApp->>Canister: Send ckBTC
    Canister->>Canister: ++ Update internal balance
```

## Create Offer Flow

```mermaid
sequenceDiagram
    participant Writer
    participant NextApp as Next App
    participant Canister as Core Canister

    Writer->>NextApp: Request create offer
    NextApp->>Canister: Query Available Bal
    Canister->>NextApp: Return Available Bal
    NextApp->>NextApp: Validates Offer
    NextApp->>Canister: Request create Offer
    Canister->>Canister: Generates Req Sig
    Canister->>NextApp: Request Approval Sig
    NextApp->>Writer: Request Approval Sig
    Writer->>NextApp: Signed Approval Sig
    NextApp->>Canister: Sends Signed Req
    Canister->>Canister: Validates Offer
    Canister->>Canister: Creates Offer
    Canister->>NextApp: Notify Created Offer
```

## Accept Offer Flow

```mermaid
sequenceDiagram
    participant Buyer
    participant NextApp as Next App
    participant Canister as Core Canister
    participant Writer

    Buyer->>NextApp: Request Accept Offer
    NextApp->>Canister: Fetch Offer Details
    Canister->>NextApp: Return Offer
    NextApp->>NextApp: Validates Offer
    NextApp->>Canister: Req Sig For Accepting
    Canister->>Canister: Generates request
    Canister->>NextApp: Send message to sign
    NextApp->>Buyer: Send message to sign
    Buyer->>NextApp: Send signed request
    NextApp->>Canister: Send signed request
    Canister->>Canister: Validate Offer
    Canister->>Canister: Validate Buyers<br/>Premium Bal
    Canister->>Writer: Send Premium ckTransfer
    Canister->>Writer: Balance Update Check
    Writer->>Canister: New Writes Balance
    Canister->>Canister: Create Active Opt
    Canister->>Canister: Validate Writers<br/>Offers (above min bal)
    Canister->>NextApp: Notify Active Option
```

## Partial Fills - Data Structure

This diagram illustrates how a writer's deposited balance is allocated across offers and active options, showing the relationship between deposited balance, available balance, offers, and active options.

```mermaid
graph TB
    subgraph "Example 1: Active Offer"
        W1[Writer]
        W1 --> B1[Deposited Balance: 1 ckBTC<br/>Available: 0.3]

        B1 --> O1[Offer 1<br/>1BTC @100k @2% 7Days<br/>Active options: 1,2<br/>Available: 0.5<br/>Remaining: 0.2 BTC<br/>Status: Active]

        B1 --> O2[Offer 2<br/>1BTC @110k @3% 7Days<br/>Available: 0.3<br/>Active options: empty<br/>State: Cancelled]

        O1 --> AO1[Active opt 1<br/>Buyer #1<br/>0.3 BTC<br/>Start Date 12/12/25]

        O1 --> AO2[Active opt 2<br/>Buyer #2<br/>0.2 BTC<br/>Start Date 15/12/25]

        OS1[Offer States:<br/>Active<br/>Cancelled<br/>Finished]
    end

    subgraph "Example 2: Filled Offers"
        W2[Writer]
        W2 --> B2[Deposited Balance: 1 ckBTC<br/>Available: 0.3]

        B2 --> O3[Offer 1<br/>1BTC @100k @2% 7Days<br/>Active options: 1,2<br/>Available: 0.0004Gain: 0.0005<br/>Remaining: 0.2 BTC<br/>Status: Filled]

        B2 --> O4[Offer 2<br/>1BTC @110k @3% 7Days<br/>Available: 0.0004Gain: 0.0005<br/>Active options: 3<br/>State: Filled]

        O3 --> AO3[Active opt 1<br/>Buyer #1<br/>0.5BTC<br/>Start Date 12/12/25]

        O3 --> AO4[Active opt 2<br/>Buyer #2<br/>0.2 BTC<br/>Start Date 15/12/25]

        O4 --> AO5[Active opt 3<br/>Buyer #3<br/>0.2946 BTC<br/>Start Date 15/12/25]
    end

    style O3 stroke:#ff0000,stroke-width:2px
    style O4 stroke:#ff0000,stroke-width:2px
```

## Offer Stitching - Data Structure (Future Feature)

This diagram illustrates how a large buyer order can be "stitched" together from multiple writers' offers. When a buyer wants to purchase more than a single writer can provide, the system automatically combines multiple offers to fulfill the order.

```mermaid
graph TB
    subgraph "Writer 1"
        W1[Writer 1]
        W1 --> B1[Deposited Balance: 1 ckBTC<br/>Available: 0.3]

        B1 --> O1[Offer 1<br/>1BTC @100k @3% 7Days<br/>Active options: 1,2,3<br/>Available: 0.3 BTC<br/>Status: Active]

        O1 --> AO1[Active opt 1<br/>Buyer #1<br/>0.5BTC<br/>Start Date 12/12/25]

        O1 --> AO2[Active opt 2<br/>Buyer #2<br/>0.2 BTC<br/>Start Date 15/12/25]

        O1 --> AO3[Active opt 3<br/>Buyer #4<br/>0.2 BTC<br/>Start Date 15/12/25]
    end

    subgraph "Writer 2"
        W2[Writer 2]
        W2 --> B2[Deposited Balance: 1 ckBTC<br/>Available: 0]

        B2 --> O2[Offer 1<br/>1BTC @100k @2% 7Days<br/>Active options: 4<br/>Available: 0 BTC<br/>Status: Filled]

        O2 --> AO4[Active opt 4<br/>Buyer #4<br/>1 BTC<br/>Start Date 15/12/25]
    end

    subgraph "Buyer 3 - Stitched Order"
        B3[Buyer 3]
        B3 --> DB3[Deposited Balance: 10 ckBTC<br/>Available: 10]

        DB3 --> AGS[Active Group Stitch 1<br/>Buyer #3<br/>1.2 BTC<br/>Active Optics 3,4<br/>Start Date: 12%3]

        AGS -.-> AO3
        AGS -.-> AO4
    end

    style O2 stroke:#ff0000,stroke-width:2px
```
