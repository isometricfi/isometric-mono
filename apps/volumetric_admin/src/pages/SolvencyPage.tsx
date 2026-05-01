import { Badge, Button, Empty, LayerCard, Table } from "@cloudflare/kumo";
import { Principal } from "@dfinity/principal";
import { ArrowsClockwise, Copy, Scales } from "@phosphor-icons/react";
import { unwrapResult } from "@volumetric/canister-types";
import { MetricCard } from "../components/MetricCard";
import { Mono } from "../components/Mono";
import { PageShell } from "../components/PageShell";
import { defaultAccount, deriveSubaccount } from "../lib/account";
import { useCreateCanisterClients } from "../lib/clients";
import { useConnection } from "../lib/connection-context";
import { formatSats } from "../lib/format";
import { useAsyncAction } from "../lib/use-async-action";

type SubaccountDriftKind = "aligned" | "unbooked_on_chain" | "fee_band" | "material";

const SOLVENCY_STATUS_LABELS = {
  aligned: "aligned",
  empty: "empty",
  hasLocked: "has locked",
  withinLedgerFee: "within 1× ledger fee",
  materialDrift: "material drift",
  unbookedOnChain: "unbooked on-chain",
} as const;

const SOLVENCY_STATUS_KEY_ENTRIES: ReadonlyArray<{
  variant: "success" | "neutral" | "warning" | "error";
  label: string;
  description: string;
}> = [
  {
    variant: "success",
    label: SOLVENCY_STATUS_LABELS.aligned,
    description:
      "Zero drift between ledger subaccount and booked available plus locked; non-zero book total and no locked balance.",
  },
  {
    variant: "neutral",
    label: SOLVENCY_STATUS_LABELS.empty,
    description: "Book total (available plus locked) is zero.",
  },
  {
    variant: "warning",
    label: SOLVENCY_STATUS_LABELS.hasLocked,
    description: "User has a non-zero locked balance (e.g. open obligation or settlement hold).",
  },
  {
    variant: "warning",
    label: SOLVENCY_STATUS_LABELS.withinLedgerFee,
    description:
      "Non-zero drift between ledger subaccount and booked available plus locked, but magnitude is at most one ICRC-1 transfer fee.",
  },
  {
    variant: "error",
    label: SOLVENCY_STATUS_LABELS.materialDrift,
    description:
      "Drift exceeds one transfer fee; reconcile User Audit, pending deposits, and settlement flows.",
  },
  {
    variant: "error",
    label: SOLVENCY_STATUS_LABELS.unbookedOnChain,
    description:
      "Ledger balance on the deposit subaccount while booked available plus locked is zero (often deposit not yet synced to the book).",
  },
];

type UserRow = {
  principal: string;
  username: string;
  depositAddress: string;
  available: bigint;
  locked: bigint;
  total: bigint;
  onChainSubaccountSats: bigint;
  bookAvailablePlusLockedSats: bigint;
  subaccountDriftSats: bigint;
  driftKind: SubaccountDriftKind;
};

type SolvencyData = {
  userRows: UserRow[];
  usersWithMaterialSubaccountDriftCount: number;
  usersWithFeeBandSubaccountDriftCount: number;
  ledgerTransferFeeSats: bigint;
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
      `Checked ${result.userCount} users (${result.usersWithMaterialSubaccountDriftCount} material drift, ${result.usersWithFeeBandSubaccountDriftCount} within 1× ledger fee). Delta: ${formatSats(
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
        ledgerTransferFeeSats,
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
        ckBtcLedger.icrc1_fee(),
      ]);

      const totalOnChainCkbtcHeldSats =
        ledgerDefaultAccountSats +
        userSubaccountLedgerBalances.reduce((sum, balance) => sum + balance, 0n);

      const userRows: UserRow[] = balanceResults.map(({ user, info }, index) => {
        const onChainSubaccountSats = userSubaccountLedgerBalances[index] ?? 0n;
        const bookAvailablePlusLockedSats = info.available + info.locked;
        const subaccountDriftSats = onChainSubaccountSats - bookAvailablePlusLockedSats;
        const base = {
          principal: user.principal.toText(),
          username: user.username[0] ?? "—",
          depositAddress: user.address,
          available: info.available,
          locked: info.locked,
          total: info.total,
          onChainSubaccountSats,
          bookAvailablePlusLockedSats,
          subaccountDriftSats,
        };
        return {
          ...base,
          driftKind: classifySubaccountDrift(base, ledgerTransferFeeSats),
        };
      });

      const usersWithMaterialSubaccountDriftCount = userRows.filter(
        (row) => row.driftKind === "material" || row.driftKind === "unbooked_on_chain",
      ).length;
      const usersWithFeeBandSubaccountDriftCount = userRows.filter(
        (row) => row.driftKind === "fee_band",
      ).length;

      const totalLiabilitiesSats =
        userRows.reduce((sum, row) => sum + row.total, 0n) + platformFeesCollectedSats;

      return {
        userRows,
        usersWithMaterialSubaccountDriftCount,
        usersWithFeeBandSubaccountDriftCount,
        ledgerTransferFeeSats,
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
      description="Sum book liabilities (user totals plus internal platform-fee counter) and compare to ckBTC on the ledger under this canister: the default account plus each user's deposit subaccount. A negative delta means on-chain assets trail book liabilities. Per user, the deposit subaccount on-chain should equal book available plus locked. Drift within one ckBTC ledger transfer fee is flagged separately from material mismatch (e.g. unsynced deposit, interrupted settlement WAL)."
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
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
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
              label="ICRC-1 transfer fee"
              value={formatSats(action.data.ledgerTransferFeeSats)}
            />
            <MetricCard
              label="Material subaccount drift"
              value={action.data.usersWithMaterialSubaccountDriftCount.toString()}
              tone={action.data.usersWithMaterialSubaccountDriftCount === 0 ? "ok" : "danger"}
            />
            <MetricCard
              label="Drift within 1× fee"
              value={action.data.usersWithFeeBandSubaccountDriftCount.toString()}
              tone={action.data.usersWithFeeBandSubaccountDriftCount === 0 ? "ok" : "warn"}
            />
            <MetricCard
              label="Delta (assets - liabilities)"
              value={formatSats(delta)}
              tone={deltaTone}
            />
          </div>

          <SolvencyTable
            rows={action.data.userRows}
            ledgerTransferFeeSats={action.data.ledgerTransferFeeSats}
          />
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

function SolvencyTable({
  rows,
  ledgerTransferFeeSats,
}: {
  rows: UserRow[];
  ledgerTransferFeeSats: bigint;
}) {
  if (rows.length === 0) return null;

  const sortedRows = [...rows].sort((a, b) => {
    const rankA = subaccountDriftKindRank(a.driftKind);
    const rankB = subaccountDriftKindRank(b.driftKind);
    if (rankA !== rankB) {
      return rankB - rankA;
    }
    const absDriftA = absBigint(a.subaccountDriftSats);
    const absDriftB = absBigint(b.subaccountDriftSats);
    if (absDriftA < absDriftB) {
      return 1;
    }
    if (absDriftA > absDriftB) {
      return -1;
    }
    if (b.total > a.total) {
      return 1;
    }
    if (b.total < a.total) {
      return -1;
    }
    return 0;
  });

  return (
    <div className="space-y-3">
      <SolvencyLegend ledgerTransferFeeSats={ledgerTransferFeeSats} />
      <LayerCard className="p-0">
        <Table>
          <Table.Header>
            <Table.Row>
              <Table.Head>Principal</Table.Head>
              <Table.Head>Username</Table.Head>
              <Table.Head>Deposit address</Table.Head>
              <Table.Head>On-chain (subaccount)</Table.Head>
              <Table.Head>Book available + locked</Table.Head>
              <Table.Head>Available</Table.Head>
              <Table.Head>Locked</Table.Head>
              <Table.Head>Subaccount drift</Table.Head>
              <Table.Head>Book total</Table.Head>
              <Table.Head>Status</Table.Head>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {sortedRows.map((row) => (
              <Table.Row key={row.principal}>
                <Table.Cell>
                  <CopyableField ariaLabel="principal" value={row.principal} />
                </Table.Cell>
                <Table.Cell>
                  <Mono className="text-sm">{row.username}</Mono>
                </Table.Cell>
                <Table.Cell>
                  <CopyableField ariaLabel="deposit address" value={row.depositAddress} />
                </Table.Cell>
                <Table.Cell>
                  <Mono>{formatSats(row.onChainSubaccountSats)}</Mono>
                </Table.Cell>
                <Table.Cell>
                  <Mono>{formatSats(row.bookAvailablePlusLockedSats)}</Mono>
                </Table.Cell>
                <Table.Cell>
                  <Mono>{formatSats(row.available)}</Mono>
                </Table.Cell>
                <Table.Cell>
                  <Mono>{formatSats(row.locked)}</Mono>
                </Table.Cell>
                <Table.Cell>{driftBadge(row)}</Table.Cell>
                <Table.Cell>
                  <Mono>{formatSats(row.total)}</Mono>
                </Table.Cell>
                <Table.Cell>{statusBadge(row)}</Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      </LayerCard>
      <p className="text-sm text-kumo-inactive">
        ICRC-1 transfer fee (ledger): {formatSats(ledgerTransferFeeSats)}. &quot;Within 1× fee&quot;
        means non-zero drift with magnitude at most that fee while the book still attributes balance
        to the user. Unbooked on-chain means a positive subaccount balance with zero book
        available+locked (often deposit not synced). Material drift warrants User Audit plus pending
        settlements / accepts.
      </p>
    </div>
  );
}

type DriftRowInput = Pick<
  UserRow,
  "subaccountDriftSats" | "bookAvailablePlusLockedSats" | "onChainSubaccountSats"
>;

function absBigint(value: bigint): bigint {
  return value >= 0n ? value : -value;
}

function classifySubaccountDrift(
  row: DriftRowInput,
  ledgerTransferFeeSats: bigint,
): SubaccountDriftKind {
  if (row.subaccountDriftSats === 0n) {
    return "aligned";
  }
  if (row.bookAvailablePlusLockedSats === 0n && row.onChainSubaccountSats > 0n) {
    return "unbooked_on_chain";
  }
  if (absBigint(row.subaccountDriftSats) <= ledgerTransferFeeSats) {
    return "fee_band";
  }
  return "material";
}

function subaccountDriftKindRank(kind: SubaccountDriftKind): number {
  if (kind === "material" || kind === "unbooked_on_chain") {
    return 2;
  }
  if (kind === "fee_band") {
    return 1;
  }
  return 0;
}

function driftBadge(row: UserRow) {
  const mono = <Mono>{formatSats(row.subaccountDriftSats)}</Mono>;
  if (row.driftKind === "aligned") {
    return <Badge variant="success">{mono}</Badge>;
  }
  if (row.driftKind === "fee_band") {
    return <Badge variant="warning">{mono}</Badge>;
  }
  return <Badge variant="error">{mono}</Badge>;
}

function statusBadge(row: UserRow) {
  if (row.driftKind === "unbooked_on_chain") {
    return <Badge variant="error">{SOLVENCY_STATUS_LABELS.unbookedOnChain}</Badge>;
  }
  if (row.driftKind === "material") {
    return <Badge variant="error">{SOLVENCY_STATUS_LABELS.materialDrift}</Badge>;
  }
  if (row.driftKind === "fee_band") {
    return <Badge variant="warning">{SOLVENCY_STATUS_LABELS.withinLedgerFee}</Badge>;
  }
  if (row.total === 0n) {
    return <Badge variant="neutral">{SOLVENCY_STATUS_LABELS.empty}</Badge>;
  }
  if (row.locked > 0n) {
    return <Badge variant="warning">{SOLVENCY_STATUS_LABELS.hasLocked}</Badge>;
  }
  return <Badge variant="success">{SOLVENCY_STATUS_LABELS.aligned}</Badge>;
}

function SolvencyLegend({ ledgerTransferFeeSats }: { ledgerTransferFeeSats: bigint }) {
  const feeExampleDrift = ledgerTransferFeeSats > 0n ? ledgerTransferFeeSats : 1n;
  const materialExampleDrift = ledgerTransferFeeSats > 0n ? ledgerTransferFeeSats + 1n : 2n;

  return (
    <LayerCard className="rounded-none border vol-hairline p-4">
      <p className="mb-3 text-xs font-medium uppercase tracking-wide text-kumo-inactive">
        Key — Status
      </p>
      <ul className="mb-6 flex flex-col gap-2.5">
        {SOLVENCY_STATUS_KEY_ENTRIES.map((entry) => (
          <li key={entry.label} className="flex flex-wrap items-start gap-2">
            <Badge variant={entry.variant}>{entry.label}</Badge>
            <span className="min-w-0 flex-1 text-sm text-kumo-inactive">{entry.description}</span>
          </li>
        ))}
      </ul>
      <p className="mb-3 text-xs font-medium uppercase tracking-wide text-kumo-inactive">
        Key — Subaccount drift
      </p>
      <ul className="flex flex-col gap-2.5">
        <li className="flex flex-wrap items-start gap-2">
          <Badge variant="success">
            <Mono>{formatSats(0n)}</Mono>
          </Badge>
          <span className="min-w-0 flex-1 text-sm text-kumo-inactive">
            No mismatch: ledger subaccount equals booked available plus locked.
          </span>
        </li>
        <li className="flex flex-wrap items-start gap-2">
          <Badge variant="warning">
            <Mono>{formatSats(feeExampleDrift)}</Mono>
          </Badge>
          <span className="min-w-0 flex-1 text-sm text-kumo-inactive">
            Non-zero drift with magnitude at most one ICRC-1 transfer fee (same band as the metric
            &quot;Drift within 1× fee&quot;).
          </span>
        </li>
        <li className="flex flex-wrap items-start gap-2">
          <Badge variant="error">
            <Mono>{formatSats(materialExampleDrift)}</Mono>
          </Badge>
          <span className="min-w-0 flex-1 text-sm text-kumo-inactive">
            Drift larger than one fee, or unbooked pattern (positive subaccount with zero booked
            available plus locked). Amount in each row is the actual delta for that user.
          </span>
        </li>
      </ul>
    </LayerCard>
  );
}

function CopyableField({ ariaLabel, value }: { ariaLabel: string; value: string }) {
  return (
    <div className="flex max-w-md items-start gap-1.5">
      <Mono className="min-w-0 flex-1 break-all text-sm">{value}</Mono>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        icon={<Copy />}
        onClick={() => void navigator.clipboard.writeText(value)}
        aria-label={`Copy ${ariaLabel}`}
      />
    </div>
  );
}
