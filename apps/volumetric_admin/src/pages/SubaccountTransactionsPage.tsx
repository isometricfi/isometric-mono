import { Badge, Button, Empty, Input, LayerCard } from "@cloudflare/kumo";
import { Principal } from "@icp-sdk/core/principal";
import { Database, MagnifyingGlass } from "@phosphor-icons/react";
import { useMemo, useState } from "react";
import { CopyButton } from "../components/CopyButton";
import { Eyebrow } from "../components/Eyebrow";
import { PageShell } from "../components/PageShell";
import type { LedgerAccount } from "../lib/account";
import { type AccountTransaction, getAllAccountTransactions } from "../lib/ckbtc-index";
import { useCreateCanisterClients } from "../lib/clients";
import { useConnection } from "../lib/connection-context";
import { bytesToHex, formatSats, principalText } from "../lib/format";
import { useAsyncAction } from "../lib/use-async-action";

const MAX_RESULTS_PER_PAGE = 100;
const MAX_PAGES = 10;

function parseSubaccountHex(hex: string): [Uint8Array, string] | null {
  const cleaned = hex.replace(/\s/g, "");
  if (cleaned.length !== 64) {
    return null;
  }
  const bytes = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    const byte = Number.parseInt(cleaned.slice(i * 2, i * 2 + 2), 16);
    if (Number.isNaN(byte)) {
      return null;
    }
    bytes[i] = byte;
  }
  return [bytes, cleaned];
}

type SubaccountAuditData = {
  subaccountHex: string;
  account: LedgerAccount;
  transactions: AccountTransaction[];
};

export function SubaccountTransactionsPage() {
  const createClients = useCreateCanisterClients();
  const { volumetricCanisterId } = useConnection();
  const [hexInput, setHexInput] = useState("");

  const action = useAsyncAction<SubaccountAuditData>({
    loadingStatus: "Fetching subaccount transactions...",
    successStatus: (result) =>
      `Found ${result.transactions.length} transactions for subaccount ${result.subaccountHex.slice(0, 16)}...`,
  });

  async function runQuery() {
    const parsed = parseSubaccountHex(hexInput);
    if (!parsed) {
      throw new Error("Enter a valid 64-char hex subaccount (32 bytes).");
    }
    const [subaccountBytes] = parsed;

    await action.run(async () => {
      const { ckBtcIndex } = createClients();
      const canisterPrincipal = Principal.fromText(volumetricCanisterId);

      const account: LedgerAccount = {
        owner: canisterPrincipal,
        subaccount: [subaccountBytes],
      };

      const result = await getAllAccountTransactions({
        indexClient: ckBtcIndex,
        account,
        maxResults: MAX_RESULTS_PER_PAGE,
        maxPages: MAX_PAGES,
      });

      return {
        subaccountHex: parsed[1],
        account,
        transactions: result.transactions,
      };
    });
  }

  async function handleSubmit() {
    try {
      await runQuery();
    } catch {
      /* handled */
    }
  }

  return (
    <PageShell
      eyebrow="Accounting / Subaccounts"
      title="Subaccount Transactions"
      description="Query the ckBTC index canister for all past transactions on a given deposit subaccount (32-byte hex). The owner is the volumetric canister itself."
      phase={action.phase}
      statusText={action.statusText}
      error={action.error}
      action={
        <Button
          variant="primary"
          icon={<MagnifyingGlass />}
          loading={action.phase === "loading"}
          onClick={handleSubmit}
        >
          Query
        </Button>
      }
    >
      <div className="max-w-xl">
        <Input
          label="Subaccount hex (64 hex chars)"
          placeholder="e.g. e783a14e62c8244d1434512267ae3669a57b5c3aebfab42d2d15767302000000"
          value={hexInput}
          onChange={(event) => setHexInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") void handleSubmit();
          }}
        />
      </div>

      {action.data ? (
        <TransactionTable transactions={action.data.transactions} />
      ) : (
        <Empty
          size="sm"
          icon={<Database size={36} className="text-kumo-inactive" />}
          title="No subaccount queried"
          description="Paste a 64-char hex subaccount to fetch its transaction history."
        />
      )}
    </PageShell>
  );
}

function TransactionTable({ transactions }: { transactions: AccountTransaction[] }) {
  const sortedTransactions = useMemo(
    () => [...transactions].sort((a, b) => Number(b.id - a.id)),
    [transactions],
  );

  if (sortedTransactions.length === 0) {
    return (
      <Empty
        size="sm"
        title="No transactions"
        description="No transactions found for this subaccount."
      />
    );
  }

  return (
    <LayerCard className="overflow-x-auto p-0">
      <div className="flex items-center justify-between border-b vol-hairline px-4 py-2.5">
        <Eyebrow>Transactions</Eyebrow>
        <Eyebrow>{sortedTransactions.length}</Eyebrow>
      </div>
      <table className="w-full text-xs font-mono">
        <thead>
          <tr className="border-b vol-hairline text-kumo-subtle">
            <th className="px-3 py-2 text-left">ID</th>
            <th className="px-3 py-2 text-left">Kind</th>
            <th className="px-3 py-2 text-right">Amount</th>
            <th className="px-3 py-2 text-left">From</th>
            <th className="px-3 py-2 text-left">To</th>
            <th className="px-3 py-2 text-left">Memo</th>
            <th className="px-3 py-2 text-left">Time</th>
          </tr>
        </thead>
        <tbody>
          {sortedTransactions.map((tx) => {
            const transfer = tx.transaction.transfer[0];
            const mint = tx.transaction.mint[0];
            const burn = tx.transaction.burn[0];
            const kind = tx.transaction.kind;
            const amount = transfer?.amount ?? mint?.amount ?? burn?.amount ?? 0n;
            const fromAccount = transfer?.from ?? burn?.from ?? null;
            const toAccount = transfer?.to ?? mint?.to ?? null;
            const memo = transfer?.memo[0] ?? mint?.memo[0] ?? burn?.memo[0] ?? null;

            return (
              <tr
                key={tx.id.toString()}
                className="border-b vol-hairline hover:bg-kumo-surface-hover"
              >
                <td className="whitespace-nowrap px-3 py-2">{tx.id.toString()}</td>
                <td className="px-3 py-2">
                  <Badge variant="neutral">{kind}</Badge>
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-right">{formatSats(amount)}</td>
                <td
                  className="max-w-[200px] truncate px-3 py-2"
                  title={fromAccount ? accountLabel(fromAccount) : ""}
                >
                  {fromAccount ? (
                    <CopyButton value={accountLabel(fromAccount)}>
                      <span>{accountLabel(fromAccount)}</span>
                    </CopyButton>
                  ) : (
                    "—"
                  )}
                </td>
                <td
                  className="max-w-[200px] truncate px-3 py-2"
                  title={toAccount ? accountLabel(toAccount) : ""}
                >
                  {toAccount ? (
                    <CopyButton value={accountLabel(toAccount)}>
                      <span>{accountLabel(toAccount)}</span>
                    </CopyButton>
                  ) : (
                    "—"
                  )}
                </td>
                <td
                  className="max-w-[160px] truncate px-3 py-2"
                  title={memo ? bytesToHex(memo) : ""}
                >
                  {memo ? (
                    <CopyButton value={bytesToHex(memo)}>
                      <span>{bytesToHex(memo)}</span>
                    </CopyButton>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="whitespace-nowrap px-3 py-2">
                  {formatTimestamp(tx.transaction.timestamp)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </LayerCard>
  );
}

function accountLabel(account: LedgerAccount): string {
  const sub = account.subaccount[0];
  if (sub) {
    return `${principalText(account.owner)}/${bytesToHex(sub).slice(0, 8)}`;
  }
  return principalText(account.owner);
}

function formatTimestamp(timestampNs: bigint): string {
  const ms = Number(timestampNs / 1_000_000n);
  return new Date(ms).toISOString().slice(0, 19).replace("T", " ");
}
