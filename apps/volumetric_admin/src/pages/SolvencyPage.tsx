import { Badge, Button, Empty, LayerCard, Table } from "@cloudflare/kumo";
import { Principal } from "@dfinity/principal";
import { ArrowsClockwise, Scales } from "@phosphor-icons/react";
import { unwrapResult } from "@volumetric/canister-types";
import { MetricCard } from "../components/MetricCard";
import { Mono } from "../components/Mono";
import { PageShell } from "../components/PageShell";
import { defaultAccount, deriveSubaccount } from "../lib/account";
import { useCreateCanisterClients } from "../lib/clients";
import { useConnection } from "../lib/connection-context";
import { formatSats, shortPrincipal } from "../lib/format";
import { useAsyncAction } from "../lib/use-async-action";

type UserRow = {
  principal: string;
  available: bigint;
  locked: bigint;
  total: bigint;
};

type SolvencyData = {
  userRows: UserRow[];
  totalLiabilitiesSats: bigint;
  platformFeesCollectedSats: bigint;
  ledgerDefaultAccountSats: bigint;
  totalOnChainCkbtcHeldSats: bigint;
  userCount: number;
};

export function SolvencyPage() {
  const createClients = useCreateCanisterClients();
  const { volumetricCanisterId } = useConnection();

  const action = useAsyncAction<SolvencyData>({
    loadingStatus: "Summing balances across all users...",
    successStatus: (result) =>
      `Checked ${result.userCount} users. Delta: ${formatSats(
        result.totalOnChainCkbtcHeldSats - result.totalLiabilitiesSats,
      )}.`,
  });

  async function runAudit() {
    await action.run(async () => {
      const { volumetric, ckBtcLedger } = createClients();
      const users = unwrapResult(await volumetric.list_users());
      const canisterPrincipal = Principal.fromText(volumetricCanisterId);

      const [
        platformFeesCollectedSats,
        balanceResults,
        ledgerDefaultAccountSats,
        userSubaccountLedgerBalances,
      ] = await Promise.all([
        volumetric.get_platform_fees_collected_total(),
        Promise.all(
          users.map(async (user) => {
            const info = unwrapResult(await volumetric.get_user_balance(user.address));
            return { user, info };
          }),
        ),
        ckBtcLedger.icrc1_balance_of(defaultAccount(canisterPrincipal)),
        Promise.all(
          users.map((user) =>
            ckBtcLedger.icrc1_balance_of({
              owner: canisterPrincipal,
              subaccount: [deriveSubaccount(user.principal)],
            }),
          ),
        ),
      ]);

      const totalOnChainCkbtcHeldSats =
        ledgerDefaultAccountSats +
        userSubaccountLedgerBalances.reduce((sum, balance) => sum + balance, 0n);

      const userRows: UserRow[] = balanceResults.map(({ user, info }) => ({
        principal: user.principal.toText(),
        available: info.available,
        locked: info.locked,
        total: info.total,
      }));

      const totalLiabilitiesSats =
        userRows.reduce((sum, row) => sum + row.total, 0n) + platformFeesCollectedSats;

      return {
        userRows,
        totalLiabilitiesSats,
        platformFeesCollectedSats,
        ledgerDefaultAccountSats,
        totalOnChainCkbtcHeldSats,
        userCount: userRows.length,
      };
    });
  }

  const delta =
    action.data === null
      ? 0n
      : action.data.totalOnChainCkbtcHeldSats - action.data.totalLiabilitiesSats;
  const deltaTone: "ok" | "warn" | "danger" = delta === 0n ? "ok" : delta > 0n ? "warn" : "danger";

  return (
    <PageShell
      eyebrow="Overview"
      title="Protocol Solvency"
      description="Sum book liabilities (user totals plus internal platform-fee counter) and compare to ckBTC on the ledger under this canister: the default account plus each user's deposit subaccount. A negative delta means on-chain assets trail book liabilities."
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
          Check solvency
        </Button>
      }
    >
      {action.data ? (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
            <MetricCard
              label="On-chain ckBTC held"
              value={formatSats(action.data.totalOnChainCkbtcHeldSats)}
            />
            <MetricCard
              label="Ledger default account"
              value={formatSats(action.data.ledgerDefaultAccountSats)}
            />
            <MetricCard
              label="Total liabilities"
              value={formatSats(action.data.totalLiabilitiesSats)}
            />
            <MetricCard
              label="Platform fees"
              value={formatSats(action.data.platformFeesCollectedSats)}
            />
            <MetricCard
              label="Delta (assets - liabilities)"
              value={formatSats(delta)}
              tone={deltaTone}
            />
          </div>

          <SolvencyTable rows={action.data.userRows} />
        </>
      ) : (
        <Empty
          size="sm"
          icon={<Scales size={36} className="text-kumo-inactive" />}
          title="No solvency snapshot"
          description="Run the check to compare assets against liabilities across all users."
        />
      )}
    </PageShell>
  );
}

function SolvencyTable({ rows }: { rows: UserRow[] }) {
  if (rows.length === 0) return null;

  const sortedRows = [...rows].sort((a, b) => (b.total > a.total ? 1 : b.total < a.total ? -1 : 0));

  return (
    <LayerCard className="p-0">
      <Table>
        <Table.Header>
          <Table.Row>
            <Table.Head>User</Table.Head>
            <Table.Head>Available</Table.Head>
            <Table.Head>Locked</Table.Head>
            <Table.Head>Total</Table.Head>
            <Table.Head>Status</Table.Head>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {sortedRows.map((row) => (
            <Table.Row key={row.principal}>
              <Table.Cell>
                <Mono className="text-sm">{shortPrincipal(row.principal)}</Mono>
              </Table.Cell>
              <Table.Cell>
                <Mono>{formatSats(row.available)}</Mono>
              </Table.Cell>
              <Table.Cell>
                <Mono>{formatSats(row.locked)}</Mono>
              </Table.Cell>
              <Table.Cell>
                <Mono>{formatSats(row.total)}</Mono>
              </Table.Cell>
              <Table.Cell>
                {row.total === 0n ? (
                  <Badge variant="neutral">empty</Badge>
                ) : row.locked > 0n ? (
                  <Badge variant="warning">has locked</Badge>
                ) : (
                  <Badge variant="success">free</Badge>
                )}
              </Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table>
    </LayerCard>
  );
}
