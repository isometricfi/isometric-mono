import {
  Badge,
  Banner,
  Button,
  Empty,
  Input,
  InputArea,
  LayerCard,
  Loader,
  Surface,
  Table,
  Text,
} from "@cloudflare/kumo";
import {
  ArrowsClockwise,
  CheckCircle,
  Coins,
  Cube,
  Database,
  MagnifyingGlass,
  ShieldCheck,
  Warning,
  WarningCircle,
} from "@phosphor-icons/react";
import type { FeeConfig, OptionAuditReport } from "@volumetric/canister-types";
import { unwrapResult } from "@volumetric/canister-types";
import { useMemo, useState } from "react";
import { accountKey, defaultAccount } from "./lib/account";
import {
  accountLabel,
  buildExpectedTransferRows,
  type ExpectedTransferAuditRow,
  sumIncomingTransfers,
  toLedgerAccount,
} from "./lib/audit";
import {
  type AccountTransaction,
  createCkBtcIndexClient,
  getAllAccountTransactions,
} from "./lib/ckbtc-index";
import { createCkBtcLedgerClient } from "./lib/ckbtc-ledger";
import {
  DEFAULT_CKBTC_INDEX_CANISTER_ID,
  DEFAULT_CKBTC_LEDGER_CANISTER_ID,
  DEFAULT_IC_HOST,
  DEFAULT_KNOWN_PROTOCOL_CANISTER_IDS,
  DEFAULT_VOLUMETRIC_CANISTER_ID,
} from "./lib/constants";
import {
  bytesToHex,
  formatBasisPoints,
  formatSats,
  formatTimestampNs,
  shortPrincipal,
} from "./lib/format";
import { getWhitelistedIdentity, getWhitelistedPrincipalText } from "./lib/identity";
import { createVolumetricClient } from "./lib/volumetric";

const DEFAULT_MAX_RESULTS = 100;
const DEFAULT_MAX_PAGES = 25;
const OPTION_AUDIT_MAX_PAGES = 5;
const TRANSACTION_PREVIEW_LIMIT = 20;
const MEMO_PREVIEW_LENGTH = 18;

type AuditPhase = "idle" | "loading" | "ready" | "error";

type AuditView = "fees" | "option";

const VIEWS: { id: AuditView; label: string; description: string }[] = [
  {
    id: "fees",
    label: "Fee Recipient",
    description: "Reconcile platform fee flows against ckBTC ledger activity.",
  },
  {
    id: "option",
    label: "Option Audit",
    description: "Verify expected vs on-chain transfers for a single option.",
  },
];

type AuditState = {
  feeConfig: FeeConfig | null;
  platformFeesCollectedSats: bigint | null;
  feeRecipientLedgerBalanceSats: bigint | null;
  feeTransactions: AccountTransaction[];
  optionReport: OptionAuditReport | null;
  expectedTransferRows: ExpectedTransferAuditRow[];
  status: string;
  phase: AuditPhase;
};

const initialAuditState: AuditState = {
  feeConfig: null,
  platformFeesCollectedSats: null,
  feeRecipientLedgerBalanceSats: null,
  feeTransactions: [],
  optionReport: null,
  expectedTransferRows: [],
  status: "Idle",
  phase: "idle",
};

function App() {
  const [icHost, setIcHost] = useState(DEFAULT_IC_HOST);
  const [volumetricCanisterId, setVolumetricCanisterId] = useState(DEFAULT_VOLUMETRIC_CANISTER_ID);
  const [ckBtcIndexCanisterId, setCkBtcIndexCanisterId] = useState(DEFAULT_CKBTC_INDEX_CANISTER_ID);
  const [ckBtcLedgerCanisterId, setCkBtcLedgerCanisterId] = useState(
    DEFAULT_CKBTC_LEDGER_CANISTER_ID,
  );
  const [knownProtocolCanisterIds, setKnownProtocolCanisterIds] = useState(
    DEFAULT_KNOWN_PROTOCOL_CANISTER_IDS.join("\n"),
  );
  const [optionId, setOptionId] = useState("");
  const [auditState, setAuditState] = useState(initialAuditState);
  const [error, setError] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<AuditView>("fees");

  function switchView(next: AuditView) {
    setActiveView(next);
    setError(null);
  }

  const adminPrincipal = useMemo(() => {
    try {
      return getWhitelistedPrincipalText();
    } catch {
      return null;
    }
  }, []);

  const knownCanisterIdList = useMemo(
    () =>
      knownProtocolCanisterIds
        .split(/\s+/)
        .map((canisterId) => canisterId.trim())
        .filter(Boolean),
    [knownProtocolCanisterIds],
  );

  async function runFeeRecipientAudit() {
    setError(null);
    setAuditState((current) => ({
      ...current,
      status: "Loading fee recipient audit...",
      phase: "loading",
    }));

    try {
      const identity = getWhitelistedIdentity();
      const volumetricClient = createVolumetricClient({
        canisterId: volumetricCanisterId,
        host: icHost,
        identity,
      });
      const indexClient = createCkBtcIndexClient({
        canisterId: ckBtcIndexCanisterId,
        host: icHost,
        identity,
      });
      const ledgerClient = createCkBtcLedgerClient({
        canisterId: ckBtcLedgerCanisterId,
        host: icHost,
        identity,
      });

      const feeConfig = await volumetricClient.get_fee_config();
      const feeRecipientAccount = defaultAccount(feeConfig.fee_recipient);
      const [platformFeesCollectedSats, feeTransactionsPage, feeRecipientLedgerBalanceSats] =
        await Promise.all([
          volumetricClient.get_platform_fees_collected_total(),
          getAllAccountTransactions({
            indexClient,
            account: feeRecipientAccount,
            maxResults: DEFAULT_MAX_RESULTS,
            maxPages: DEFAULT_MAX_PAGES,
          }),
          ledgerClient.icrc1_balance_of(feeRecipientAccount),
        ]);

      setAuditState((current) => ({
        ...current,
        feeConfig,
        platformFeesCollectedSats,
        feeRecipientLedgerBalanceSats,
        feeTransactions: feeTransactionsPage.transactions,
        status: `Loaded ${feeTransactionsPage.transactions.length} fee-recipient transactions.`,
        phase: "ready",
      }));
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : String(caughtError));
      setAuditState((current) => ({
        ...current,
        status: "Fee recipient audit failed.",
        phase: "error",
      }));
    }
  }

  async function runOptionAudit() {
    setError(null);
    const parsedOptionId = Number.parseInt(optionId, 10);
    if (!Number.isSafeInteger(parsedOptionId) || parsedOptionId <= 0) {
      setError("Enter a valid option id.");
      return;
    }

    setAuditState((current) => ({
      ...current,
      status: `Loading option ${parsedOptionId}...`,
      phase: "loading",
    }));

    try {
      const identity = getWhitelistedIdentity();
      const volumetricClient = createVolumetricClient({
        canisterId: volumetricCanisterId,
        host: icHost,
        identity,
      });
      const indexClient = createCkBtcIndexClient({
        canisterId: ckBtcIndexCanisterId,
        host: icHost,
        identity,
      });

      const report = unwrapResult(
        await volumetricClient.get_option_audit_report(BigInt(parsedOptionId)),
      );
      const accountsToQuery = new Map(
        report.expected_transfers.map((expectedTransfer) => {
          const account = toLedgerAccount(expectedTransfer.to);
          return [accountKey(account), account] as const;
        }),
      );
      const transactionPages = await Promise.all(
        Array.from(accountsToQuery.values()).map((account) =>
          getAllAccountTransactions({
            indexClient,
            account,
            maxResults: DEFAULT_MAX_RESULTS,
            maxPages: OPTION_AUDIT_MAX_PAGES,
          }),
        ),
      );
      const transactions = transactionPages.flatMap((page) => page.transactions);

      setAuditState((current) => ({
        ...current,
        optionReport: report,
        expectedTransferRows: buildExpectedTransferRows(report, transactions),
        status: `Loaded option ${parsedOptionId} and ${transactions.length} related ledger transactions.`,
        phase: "ready",
      }));
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : String(caughtError));
      setAuditState((current) => ({
        ...current,
        status: "Option audit failed.",
        phase: "error",
      }));
    }
  }

  const feeRecipientIncomingTotal =
    auditState.feeConfig === null
      ? 0n
      : sumIncomingTransfers({
          transactions: auditState.feeTransactions,
          toOwner: auditState.feeConfig.fee_recipient.toText(),
          fromOwners: knownCanisterIdList,
        });

  const isLoading = auditState.phase === "loading";

  return (
    <div className="min-h-screen bg-kumo-app text-kumo-default">
      <HeaderBar
        adminPrincipal={adminPrincipal}
        phase={auditState.phase}
        status={auditState.status}
        activeView={activeView}
      />

      <ViewTabs activeView={activeView} onChange={switchView} />

      <main className="mx-auto flex max-w-[1100px] flex-col gap-0 px-6 pb-20">
        <ViewIntro view={activeView} />

        <ConnectionPanel
          icHost={icHost}
          onIcHostChange={setIcHost}
          volumetricCanisterId={volumetricCanisterId}
          onVolumetricCanisterIdChange={setVolumetricCanisterId}
          ckBtcIndexCanisterId={ckBtcIndexCanisterId}
          onCkBtcIndexCanisterIdChange={setCkBtcIndexCanisterId}
          ckBtcLedgerCanisterId={ckBtcLedgerCanisterId}
          onCkBtcLedgerCanisterIdChange={setCkBtcLedgerCanisterId}
        />

        {error ? (
          <div className="mt-6">
            <Banner
              icon={<WarningCircle weight="fill" />}
              variant="error"
              title="Audit error"
              description={error}
            />
          </div>
        ) : null}

        <div className="mt-6">
          {activeView === "fees" ? (
            <FeeRecipientPanel
              feeConfig={auditState.feeConfig}
              platformFeesCollectedSats={auditState.platformFeesCollectedSats}
              feeRecipientLedgerBalanceSats={auditState.feeRecipientLedgerBalanceSats}
              feeRecipientIncomingTotal={feeRecipientIncomingTotal}
              feeTransactions={auditState.feeTransactions}
              knownProtocolCanisterIds={knownProtocolCanisterIds}
              onKnownProtocolCanisterIdsChange={setKnownProtocolCanisterIds}
              onLoadFees={runFeeRecipientAudit}
              isLoading={isLoading}
            />
          ) : (
            <OptionAuditPanel
              optionId={optionId}
              onOptionIdChange={setOptionId}
              report={auditState.optionReport}
              rows={auditState.expectedTransferRows}
              onAudit={runOptionAudit}
              isLoading={isLoading}
            />
          )}
        </div>
      </main>
    </div>
  );
}

function ViewTabs({
  activeView,
  onChange,
}: {
  activeView: AuditView;
  onChange: (next: AuditView) => void;
}) {
  return (
    <nav className="sticky top-[57px] z-[9] border-b vol-hairline bg-[color:var(--vol-ground)]/90 backdrop-blur">
      <div className="mx-auto flex max-w-[1100px] items-stretch gap-0 px-6">
        {VIEWS.map((view) => {
          const isActive = view.id === activeView;
          return (
            <button
              key={view.id}
              type="button"
              onClick={() => onChange(view.id)}
              className={`relative -mb-px border-b-2 px-4 py-3 text-[13px] font-medium tracking-tight transition-colors ${
                isActive
                  ? "border-[color:var(--vol-accent)] text-kumo-strong"
                  : "border-transparent text-kumo-subtle hover:text-kumo-default"
              }`}
            >
              {view.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

function ViewIntro({ view }: { view: AuditView }) {
  const meta = VIEWS.find((entry) => entry.id === view);
  if (!meta) return null;
  return (
    <section className="relative border-b vol-hairline py-8">
      <div className="vol-grid-bg absolute inset-0 -z-0 opacity-30" aria-hidden />
      <div className="relative z-10 flex flex-col gap-2">
        <Eyebrow>{meta.label}</Eyebrow>
        <h1 className="max-w-[36ch] text-[32px] font-semibold leading-[1.1] tracking-[-0.02em] text-kumo-strong">
          {meta.description}
        </h1>
      </div>
    </section>
  );
}

function HeaderBar({
  adminPrincipal,
  phase,
  status,
  activeView,
}: {
  adminPrincipal: string | null;
  phase: AuditPhase;
  status: string;
  activeView: AuditView;
}) {
  const viewLabel = VIEWS.find((entry) => entry.id === activeView)?.label ?? "";
  return (
    <header className="sticky top-0 z-10 border-b vol-hairline-strong bg-[color:var(--vol-ground)]/90 backdrop-blur">
      <div className="mx-auto flex max-w-[1100px] items-center justify-between gap-6 px-6 py-3.5">
        <div className="flex items-center gap-3">
          <span className="vol-accent-dot" aria-hidden />
          <Mono className="text-[11px] uppercase tracking-[0.18em] text-kumo-subtle">
            Volumetric
          </Mono>
          <span className="text-kumo-inactive">/</span>
          <span className="text-[13px] font-medium text-kumo-strong">Admin Console</span>
          <span className="text-kumo-inactive">/</span>
          <span className="text-[13px] text-kumo-default">{viewLabel}</span>
        </div>

        <div className="flex items-center gap-5">
          <StatusBadge phase={phase} status={status} />
          <div className="hidden items-center gap-2 md:flex">
            <ShieldCheck size={14} className="text-[color:var(--vol-accent)]" weight="fill" />
            <Mono className="text-[12px] text-kumo-subtle">
              {adminPrincipal ? shortPrincipal(adminPrincipal) : "no identity"}
            </Mono>
          </div>
        </div>
      </div>
    </header>
  );
}

function StatusBadge({ phase, status }: { phase: AuditPhase; status: string }) {
  const dotColorClass =
    phase === "error"
      ? "bg-red-400"
      : phase === "ready"
        ? "bg-emerald-400"
        : phase === "loading"
          ? "bg-amber-400 animate-pulse"
          : "bg-kumo-inactive";

  return (
    <div className="hidden items-center gap-2 md:flex">
      {phase === "loading" ? (
        <Loader size="sm" />
      ) : (
        <span className={`size-1.5 rounded-full ${dotColorClass}`} aria-hidden />
      )}
      <span className="text-[13px] text-kumo-subtle">{status}</span>
    </div>
  );
}

function ConnectionPanel({
  icHost,
  onIcHostChange,
  volumetricCanisterId,
  onVolumetricCanisterIdChange,
  ckBtcIndexCanisterId,
  onCkBtcIndexCanisterIdChange,
  ckBtcLedgerCanisterId,
  onCkBtcLedgerCanisterIdChange,
}: {
  icHost: string;
  onIcHostChange: (value: string) => void;
  volumetricCanisterId: string;
  onVolumetricCanisterIdChange: (value: string) => void;
  ckBtcIndexCanisterId: string;
  onCkBtcIndexCanisterIdChange: (value: string) => void;
  ckBtcLedgerCanisterId: string;
  onCkBtcLedgerCanisterIdChange: (value: string) => void;
}) {
  return (
    <Surface className="mt-6 rounded-none border vol-hairline p-0">
      <div className="flex items-center justify-between border-b vol-hairline px-5 py-3">
        <div className="flex items-center gap-2">
          <Database size={14} className="text-kumo-subtle" />
          <Eyebrow>Connection</Eyebrow>
        </div>
        <Mono className="text-[11px] text-kumo-inactive">read-only</Mono>
      </div>
      <div className="grid grid-cols-1 gap-px bg-[color:var(--vol-hairline)] md:grid-cols-2 xl:grid-cols-4">
        <div className="bg-kumo-base p-4">
          <Input
            label="IC host"
            value={icHost}
            onChange={(event) => onIcHostChange(event.target.value)}
          />
        </div>
        <div className="bg-kumo-base p-4">
          <Input
            label="Volumetric canister"
            value={volumetricCanisterId}
            onChange={(event) => onVolumetricCanisterIdChange(event.target.value)}
          />
        </div>
        <div className="bg-kumo-base p-4">
          <Input
            label="ckBTC index"
            value={ckBtcIndexCanisterId}
            onChange={(event) => onCkBtcIndexCanisterIdChange(event.target.value)}
          />
        </div>
        <div className="bg-kumo-base p-4">
          <Input
            label="ckBTC ledger"
            value={ckBtcLedgerCanisterId}
            onChange={(event) => onCkBtcLedgerCanisterIdChange(event.target.value)}
          />
        </div>
      </div>
    </Surface>
  );
}

function FeeRecipientPanel({
  feeConfig,
  platformFeesCollectedSats,
  feeRecipientLedgerBalanceSats,
  feeRecipientIncomingTotal,
  feeTransactions,
  knownProtocolCanisterIds,
  onKnownProtocolCanisterIdsChange,
  onLoadFees,
  isLoading,
}: {
  feeConfig: FeeConfig | null;
  platformFeesCollectedSats: bigint | null;
  feeRecipientLedgerBalanceSats: bigint | null;
  feeRecipientIncomingTotal: bigint;
  feeTransactions: AccountTransaction[];
  knownProtocolCanisterIds: string;
  onKnownProtocolCanisterIdsChange: (value: string) => void;
  onLoadFees: () => void;
  isLoading: boolean;
}) {
  return (
    <Surface className="flex flex-col gap-5 rounded-none border vol-hairline p-6">
      <PanelHeader
        icon={<Coins size={16} />}
        eyebrow="Fee Recipient"
        title="Platform Fee Reconciliation"
        action={
          <Button
            variant="primary"
            icon={<ArrowsClockwise />}
            loading={isLoading}
            onClick={onLoadFees}
          >
            Load fees
          </Button>
        }
      />

      {feeConfig ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <MetricCard label="Fee recipient" value={shortPrincipal(feeConfig.fee_recipient)} mono />
          <MetricCard
            label="Premium fee"
            value={formatBasisPoints(feeConfig.premium_fee_basis_points)}
          />
          <MetricCard
            label="Profit fee"
            value={formatBasisPoints(feeConfig.profit_fee_basis_points)}
          />
          <MetricCard
            label="Ledger balance"
            value={formatSats(feeRecipientLedgerBalanceSats ?? 0n)}
          />
          <MetricCard
            label="Canister fee counter"
            value={formatSats(platformFeesCollectedSats ?? 0n)}
          />
          <MetricCard label="Known inbound total" value={formatSats(feeRecipientIncomingTotal)} />
        </div>
      ) : (
        <Empty
          size="sm"
          icon={<Coins size={36} className="text-kumo-inactive" />}
          title="No fee data loaded"
          description="Load the fee recipient audit to inspect config, balances, and inbound totals."
        />
      )}

      <InputArea
        label="Known protocol canisters"
        description="Sum inbound transfers from these principals into the fee recipient."
        rows={3}
        value={knownProtocolCanisterIds}
        onChange={(event) => onKnownProtocolCanisterIdsChange(event.target.value)}
      />

      <div>
        <div className="mb-2 flex items-center justify-between">
          <Eyebrow>Recent fee-recipient transfers</Eyebrow>
          <Eyebrow>{feeTransactions.length} loaded</Eyebrow>
        </div>
        <FeeTransactionTable transactions={feeTransactions.slice(0, TRANSACTION_PREVIEW_LIMIT)} />
      </div>
    </Surface>
  );
}

function OptionAuditPanel({
  optionId,
  onOptionIdChange,
  report,
  rows,
  onAudit,
  isLoading,
}: {
  optionId: string;
  onOptionIdChange: (value: string) => void;
  report: OptionAuditReport | null;
  rows: ExpectedTransferAuditRow[];
  onAudit: () => void;
  isLoading: boolean;
}) {
  return (
    <Surface className="flex flex-col gap-5 rounded-none border vol-hairline p-6">
      <PanelHeader
        icon={<Cube size={16} />}
        eyebrow="Option Audit"
        title="Expected vs On-chain Transfers"
        action={
          <Button
            variant="primary"
            icon={<MagnifyingGlass />}
            loading={isLoading}
            onClick={onAudit}
          >
            Audit option
          </Button>
        }
      />

      <div className="grid grid-cols-[1fr_auto] items-end gap-3">
        <Input
          label="Option id"
          placeholder="e.g. 42"
          value={optionId}
          onChange={(event) => onOptionIdChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") onAudit();
          }}
        />
      </div>

      <OptionSummary report={report} />
      <ExpectedTransferTable rows={rows} />
    </Surface>
  );
}

function PanelHeader({
  icon,
  eyebrow,
  title,
  action,
}: {
  icon: React.ReactNode;
  eyebrow: string;
  title: string;
  action: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b vol-hairline pb-4">
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2 text-[color:var(--vol-accent)]">
          {icon}
          <Eyebrow>{eyebrow}</Eyebrow>
        </div>
        <h2 className="text-[22px] font-semibold tracking-[-0.01em] text-kumo-strong">{title}</h2>
      </div>
      {action}
    </div>
  );
}

function MetricCard({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <LayerCard className="rounded-none border-l-2 border-l-[color:var(--vol-accent-soft)] p-3">
      <Eyebrow>{label}</Eyebrow>
      <div
        className={`mt-1.5 text-[17px] font-semibold tracking-tight text-kumo-strong ${mono ? "font-mono text-[15px]" : ""}`}
      >
        {value}
      </div>
    </LayerCard>
  );
}

function OptionSummary({ report }: { report: OptionAuditReport | null }) {
  if (!report) {
    return (
      <Empty
        size="sm"
        icon={<Cube size={36} className="text-kumo-inactive" />}
        title="No option loaded"
        description="Enter an option id and audit to populate the expected transfer ledger."
      />
    );
  }

  const option = report.option[0];

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
      <MetricCard label="Option id" value={report.option_id.toString()} />
      <MetricCard label="Buyer" value={option ? shortPrincipal(option.buyer) : "unknown"} mono />
      <MetricCard label="Writer" value={option ? shortPrincipal(option.writer) : "unknown"} mono />
      <MetricCard label="Premium paid" value={formatSats(option?.premium_paid ?? 0n)} />
      <MetricCard label="Option events" value={report.option_events.length.toString()} />
      <MetricCard label="Expected transfers" value={report.expected_transfers.length.toString()} />
    </div>
  );
}

function ExpectedTransferTable({ rows }: { rows: ExpectedTransferAuditRow[] }) {
  if (rows.length === 0) {
    return (
      <Empty
        size="sm"
        icon={<Database size={36} className="text-kumo-inactive" />}
        title="No expected transfers yet"
        description="Expected transfers derived from option state will appear here."
      />
    );
  }

  return (
    <LayerCard className="p-0">
      <Table>
        <Table.Header>
          <Table.Row>
            <Table.Head>Status</Table.Head>
            <Table.Head>Kind</Table.Head>
            <Table.Head>Amount</Table.Head>
            <Table.Head>To</Table.Head>
            <Table.Head>Matches</Table.Head>
            <Table.Head>Memo</Table.Head>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {rows.map((row) => (
            <Table.Row key={row.key}>
              <Table.Cell>
                <TransferStatusBadge status={row.status} />
              </Table.Cell>
              <Table.Cell title={row.note}>{row.kind}</Table.Cell>
              <Table.Cell>
                <Mono>{formatSats(row.amountSats)}</Mono>
              </Table.Cell>
              <Table.Cell>
                <Mono className="text-sm">{accountLabel(row.to)}</Mono>
              </Table.Cell>
              <Table.Cell>
                <Mono className="text-sm">
                  {row.matchedTransactionIds.map((id) => id.toString()).join(", ") || "—"}
                </Mono>
              </Table.Cell>
              <Table.Cell>
                <Mono className="text-sm">{`${row.memoHex.slice(0, MEMO_PREVIEW_LENGTH)}…`}</Mono>
              </Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table>
    </LayerCard>
  );
}

function TransferStatusBadge({ status }: { status: ExpectedTransferAuditRow["status"] }) {
  if (status === "matched") {
    return (
      <Badge variant="success">
        <CheckCircle size={12} weight="fill" className="mr-1" />
        matched
      </Badge>
    );
  }
  if (status === "missing") {
    return (
      <Badge variant="error">
        <WarningCircle size={12} weight="fill" className="mr-1" />
        missing
      </Badge>
    );
  }
  if (status === "ambiguous") {
    return (
      <Badge variant="warning">
        <Warning size={12} weight="fill" className="mr-1" />
        ambiguous
      </Badge>
    );
  }
  return <Badge variant="neutral">{status}</Badge>;
}

function FeeTransactionTable({ transactions }: { transactions: AccountTransaction[] }) {
  if (transactions.length === 0) {
    return (
      <Empty
        size="sm"
        icon={<Coins size={36} className="text-kumo-inactive" />}
        title="No fee-recipient transactions loaded"
        description="Run the fee audit to fetch recent transfers from the ckBTC index canister."
      />
    );
  }

  return (
    <LayerCard className="p-0">
      <Table>
        <Table.Header>
          <Table.Row>
            <Table.Head>Tx id</Table.Head>
            <Table.Head>Amount</Table.Head>
            <Table.Head>From</Table.Head>
            <Table.Head>Time</Table.Head>
            <Table.Head>Memo</Table.Head>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {transactions.map((accountTransaction) => {
            const transfer = accountTransaction.transaction.transfer[0];
            return (
              <Table.Row key={accountTransaction.id.toString()}>
                <Table.Cell>
                  <Mono className="text-sm">{accountTransaction.id.toString()}</Mono>
                </Table.Cell>
                <Table.Cell>
                  <Mono>{transfer ? formatSats(transfer.amount) : "—"}</Mono>
                </Table.Cell>
                <Table.Cell>
                  <Mono className="text-sm">
                    {transfer ? shortPrincipal(transfer.from.owner) : "—"}
                  </Mono>
                </Table.Cell>
                <Table.Cell>
                  <Text size="sm">
                    {formatTimestampNs(accountTransaction.transaction.timestamp)}
                  </Text>
                </Table.Cell>
                <Table.Cell>
                  <Mono className="text-sm">
                    {transfer?.memo[0]
                      ? `${bytesToHex(transfer.memo[0]).slice(0, MEMO_PREVIEW_LENGTH)}…`
                      : "none"}
                  </Mono>
                </Table.Cell>
              </Table.Row>
            );
          })}
        </Table.Body>
      </Table>
    </LayerCard>
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <span className="font-mono text-xs uppercase tracking-wider text-kumo-subtle">{children}</span>
  );
}

function Mono({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <span className={`font-mono ${className}`.trim()}>{children}</span>;
}

export default App;
