import { Badge, Button, Empty, LayerCard, Table } from "@cloudflare/kumo";
import { Principal } from "@dfinity/principal";
import { ArrowsClockwise, HandCoins } from "@phosphor-icons/react";
import type { PendingWithdrawal } from "@volumetric/canister-types";
import { unwrapResult } from "@volumetric/canister-types";
import { MetricCard } from "../components/MetricCard";
import { Mono } from "../components/Mono";
import { PageShell } from "../components/PageShell";
import { defaultAccount } from "../lib/account";
import { type AccountTransaction, getAllAccountTransactions } from "../lib/ckbtc-index";
import { useCreateCanisterClients } from "../lib/clients";
import { useConnection } from "../lib/connection-context";
import { formatSats, shortPrincipal } from "../lib/format";
import { useAsyncAction } from "../lib/use-async-action";

const CKBTC_INDEX_MAX_RESULTS = 100;
const CKBTC_INDEX_MAX_PAGES = 10;
const OVERDUE_SECONDS = 1_800;

type WithdrawalRow = {
  withdrawal: PendingWithdrawal;
  status: "in-flight" | "on-chain" | "overdue";
  matchedTxId: bigint | null;
};

type PendingWithdrawalsData = {
  rows: WithdrawalRow[];
  totalOwedSats: bigint;
};

export function PendingWithdrawalsPage() {
  const createClients = useCreateCanisterClients();
  const { volumetricCanisterId } = useConnection();

  const action = useAsyncAction<PendingWithdrawalsData>({
    loadingStatus: "Fetching pending withdrawals and cross-checking ledger...",
    successStatus: (result) =>
      `${result.rows.length} pending. ${formatSats(result.totalOwedSats)} still owed.`,
  });

  async function runAudit() {
    await action.run(async () => {
      const { volumetric, ckBtcIndex } = createClients();
      const canisterPrincipal = Principal.fromText(volumetricCanisterId);
      const withdrawals = unwrapResult(await volumetric.get_pending_withdrawals());

      const canisterOutgoing = await getAllAccountTransactions({
        indexClient: ckBtcIndex,
        account: defaultAccount(canisterPrincipal),
        maxResults: CKBTC_INDEX_MAX_RESULTS,
        maxPages: CKBTC_INDEX_MAX_PAGES,
      });

      const nowSeconds = BigInt(Math.floor(Date.now() / 1000));
      const rows: WithdrawalRow[] = withdrawals.map((withdrawal) => {
        const matched = findMatchingOutbound(canisterOutgoing.transactions, withdrawal);
        const ageSeconds = nowSeconds - withdrawal.created_at_seconds;
        const status: WithdrawalRow["status"] = matched
          ? "on-chain"
          : ageSeconds > BigInt(OVERDUE_SECONDS)
            ? "overdue"
            : "in-flight";
        return { withdrawal, status, matchedTxId: matched?.id ?? null };
      });

      const totalOwedSats = rows
        .filter((row) => row.status !== "on-chain")
        .reduce((sum, row) => sum + row.withdrawal.amount, 0n);

      return { rows, totalOwedSats };
    });
  }

  const overdueCount = action.data?.rows.filter((row) => row.status === "overdue").length ?? 0;

  return (
    <PageShell
      eyebrow="Accounting"
      title="Pending Withdrawals"
      description="Withdrawals still in flight. Each row is cross-referenced against outbound ckBTC transfers from the canister to confirm the payout landed on the ledger."
      phase={action.phase}
      statusText={action.statusText}
      error={action.error}
      action={
        <Button
          variant="primary"
          icon={<ArrowsClockwise />}
          loading={action.phase === "loading"}
          onClick={runAudit}
        >
          Refresh
        </Button>
      }
    >
      {action.data ? (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            <MetricCard label="Pending" value={action.data.rows.length.toString()} />
            <MetricCard
              label="Overdue (>30m)"
              value={overdueCount.toString()}
              tone={overdueCount > 0 ? "danger" : "ok"}
            />
            <MetricCard label="Still owed" value={formatSats(action.data.totalOwedSats)} />
          </div>
          <WithdrawalsTable rows={action.data.rows} />
        </>
      ) : (
        <Empty
          size="sm"
          icon={<HandCoins size={36} className="text-kumo-inactive" />}
          title="No data loaded"
          description="Refresh to pull pending withdrawals and cross-check them against the ckBTC ledger."
        />
      )}
    </PageShell>
  );
}

function WithdrawalsTable({ rows }: { rows: WithdrawalRow[] }) {
  if (rows.length === 0) {
    return (
      <Empty
        size="sm"
        icon={<HandCoins size={36} className="text-kumo-inactive" />}
        title="No pending withdrawals"
        description="Every requested withdrawal has been completed or failed."
      />
    );
  }

  return (
    <LayerCard className="p-0">
      <Table>
        <Table.Header>
          <Table.Row>
            <Table.Head>ID</Table.Head>
            <Table.Head>Status</Table.Head>
            <Table.Head>Principal</Table.Head>
            <Table.Head>BTC address</Table.Head>
            <Table.Head>Amount</Table.Head>
            <Table.Head>Matched tx</Table.Head>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {rows.map(({ withdrawal, status, matchedTxId }) => (
            <Table.Row key={withdrawal.id.toString()}>
              <Table.Cell>
                <Mono>{withdrawal.id.toString()}</Mono>
              </Table.Cell>
              <Table.Cell>
                <StatusChip status={status} />
              </Table.Cell>
              <Table.Cell>
                <Mono className="text-sm">{shortPrincipal(withdrawal.principal)}</Mono>
              </Table.Cell>
              <Table.Cell>
                <Mono className="text-sm">{shortenAddress(withdrawal.btc_address)}</Mono>
              </Table.Cell>
              <Table.Cell>
                <Mono>{formatSats(withdrawal.amount)}</Mono>
              </Table.Cell>
              <Table.Cell>
                <Mono className="text-sm">{matchedTxId?.toString() ?? "—"}</Mono>
              </Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table>
    </LayerCard>
  );
}

function StatusChip({ status }: { status: WithdrawalRow["status"] }) {
  if (status === "on-chain") return <Badge variant="success">on-chain</Badge>;
  if (status === "overdue") return <Badge variant="error">overdue</Badge>;
  return <Badge variant="warning">in-flight</Badge>;
}

function findMatchingOutbound(
  transactions: AccountTransaction[],
  withdrawal: PendingWithdrawal,
): AccountTransaction | null {
  return (
    transactions.find((transaction) => {
      const transfer = transaction.transaction.transfer[0];
      if (!transfer) return false;
      if (transfer.amount !== withdrawal.amount) return false;
      const toOwner = transfer.to.owner.toText();
      return toOwner === withdrawal.principal.toText();
    }) ?? null
  );
}

function shortenAddress(address: string): string {
  if (address.length <= 18) return address;
  return `${address.slice(0, 9)}...${address.slice(-7)}`;
}
