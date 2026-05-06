import { Actor, type ActorSubclass, HttpAgent, type Identity } from "@icp-sdk/core/agent";
import { IDL } from "@icp-sdk/core/candid";
import { Principal } from "@icp-sdk/core/principal";

import type { LedgerAccount } from "./account";

type Optional<T> = [] | [T];

export type IndexTransfer = {
  to: LedgerAccount;
  fee: Optional<bigint>;
  from: LedgerAccount;
  memo: Optional<Uint8Array | number[]>;
  created_at_time: Optional<bigint>;
  amount: bigint;
  spender: Optional<LedgerAccount>;
};

export type IndexMint = {
  to: LedgerAccount;
  fee: Optional<bigint>;
  memo: Optional<Uint8Array | number[]>;
  created_at_time: Optional<bigint>;
  amount: bigint;
};

export type IndexBurn = {
  fee: Optional<bigint>;
  from: LedgerAccount;
  memo: Optional<Uint8Array | number[]>;
  created_at_time: Optional<bigint>;
  amount: bigint;
  spender: Optional<LedgerAccount>;
};

export type IndexTransaction = {
  burn: Optional<IndexBurn>;
  kind: string;
  mint: Optional<IndexMint>;
  approve: Optional<unknown>;
  fee_collector: Optional<unknown>;
  timestamp: bigint;
  transfer: Optional<IndexTransfer>;
};

export type AccountTransaction = {
  id: bigint;
  transaction: IndexTransaction;
};

type GetAccountTransactionsArgs = {
  max_results: bigint;
  start: Optional<bigint>;
  account: LedgerAccount;
};

type GetAccountTransactionsResponse =
  | {
      Ok: {
        balance: bigint;
        transactions: AccountTransaction[];
        oldest_tx_id: Optional<bigint>;
      };
    }
  | { Err: { message: string } };

type CkBtcIndexService = {
  get_account_transactions: (
    args: GetAccountTransactionsArgs,
  ) => Promise<GetAccountTransactionsResponse>;
};

export type AccountTransactionsPage = {
  balance: bigint;
  transactions: AccountTransaction[];
  oldestTxId: bigint | null;
};

export function createCkBtcIndexClient({
  canisterId,
  host,
  identity,
}: {
  canisterId: string;
  host: string;
  identity?: Identity;
}): ActorSubclass<CkBtcIndexService> {
  const agent = new HttpAgent({ host, identity });
  return Actor.createActor<CkBtcIndexService>(ckBtcIndexIdlFactory, {
    agent,
    canisterId,
  });
}

export async function getAccountTransactionsPage({
  indexClient,
  account,
  maxResults,
  start,
}: {
  indexClient: CkBtcIndexService;
  account: LedgerAccount;
  maxResults: number;
  start: bigint | null;
}): Promise<AccountTransactionsPage> {
  const response = await indexClient.get_account_transactions({
    max_results: BigInt(maxResults),
    start: start === null ? [] : [start],
    account,
  });

  if ("Err" in response) {
    throw new Error(response.Err.message);
  }

  return {
    balance: response.Ok.balance,
    transactions: response.Ok.transactions,
    oldestTxId: response.Ok.oldest_tx_id[0] ?? null,
  };
}

export async function getAllAccountTransactions({
  indexClient,
  account,
  maxResults,
  maxPages,
}: {
  indexClient: CkBtcIndexService;
  account: LedgerAccount;
  maxResults: number;
  maxPages: number;
}): Promise<AccountTransactionsPage> {
  const transactions: AccountTransaction[] = [];
  const seenTransactionIds = new Set<string>();
  let balance = 0n;
  let start: bigint | null = null;
  let oldestTxId: bigint | null = null;

  for (let pageIndex = 0; pageIndex < maxPages; pageIndex += 1) {
    const page = await getAccountTransactionsPage({
      indexClient,
      account,
      maxResults,
      start,
    });
    balance = page.balance;
    oldestTxId = page.oldestTxId;

    if (page.transactions.length === 0) {
      break;
    }

    const newTransactions = page.transactions.filter((transaction) => {
      const transactionId = transaction.id.toString();
      if (seenTransactionIds.has(transactionId)) {
        return false;
      }
      seenTransactionIds.add(transactionId);
      return true;
    });

    if (newTransactions.length === 0) {
      break;
    }

    transactions.push(...newTransactions);

    if (page.oldestTxId === null || page.oldestTxId === start) {
      break;
    }

    start = page.oldestTxId;
  }

  return { balance, transactions, oldestTxId };
}

const accountIdl = IDL.Record({
  owner: IDL.Principal,
  subaccount: IDL.Opt(IDL.Vec(IDL.Nat8)),
});

const transferIdl = IDL.Record({
  to: accountIdl,
  fee: IDL.Opt(IDL.Nat),
  from: accountIdl,
  memo: IDL.Opt(IDL.Vec(IDL.Nat8)),
  created_at_time: IDL.Opt(IDL.Nat64),
  amount: IDL.Nat,
  spender: IDL.Opt(accountIdl),
});

const burnIdl = IDL.Record({
  fee: IDL.Opt(IDL.Nat),
  from: accountIdl,
  memo: IDL.Opt(IDL.Vec(IDL.Nat8)),
  created_at_time: IDL.Opt(IDL.Nat64),
  amount: IDL.Nat,
  spender: IDL.Opt(accountIdl),
});

const mintIdl = IDL.Record({
  to: accountIdl,
  fee: IDL.Opt(IDL.Nat),
  memo: IDL.Opt(IDL.Vec(IDL.Nat8)),
  created_at_time: IDL.Opt(IDL.Nat64),
  amount: IDL.Nat,
});

const approveIdl = IDL.Record({
  fee: IDL.Opt(IDL.Nat),
  from: accountIdl,
  memo: IDL.Opt(IDL.Vec(IDL.Nat8)),
  created_at_time: IDL.Opt(IDL.Nat64),
  amount: IDL.Nat,
  expected_allowance: IDL.Opt(IDL.Nat),
  expires_at: IDL.Opt(IDL.Nat64),
  spender: accountIdl,
});

const feeCollectorIdl = IDL.Record({
  ts: IDL.Opt(IDL.Nat64),
  mthd: IDL.Opt(IDL.Text),
  fee_collector: IDL.Opt(accountIdl),
  caller: IDL.Opt(IDL.Principal),
});

const transactionIdl = IDL.Record({
  burn: IDL.Opt(burnIdl),
  kind: IDL.Text,
  mint: IDL.Opt(mintIdl),
  approve: IDL.Opt(approveIdl),
  fee_collector: IDL.Opt(feeCollectorIdl),
  timestamp: IDL.Nat64,
  transfer: IDL.Opt(transferIdl),
});

const ckBtcIndexIdlFactory: IDL.InterfaceFactory = ({ IDL }) =>
  IDL.Service({
    get_account_transactions: IDL.Func(
      [
        IDL.Record({
          max_results: IDL.Nat,
          start: IDL.Opt(IDL.Nat),
          account: accountIdl,
        }),
      ],
      [
        IDL.Variant({
          Ok: IDL.Record({
            balance: IDL.Nat,
            transactions: IDL.Vec(
              IDL.Record({
                id: IDL.Nat,
                transaction: transactionIdl,
              }),
            ),
            oldest_tx_id: IDL.Opt(IDL.Nat),
          }),
          Err: IDL.Record({ message: IDL.Text }),
        }),
      ],
      ["query"],
    ),
  });

export function parsePrincipal(text: string): Principal {
  return Principal.fromText(text.trim());
}
