import { Badge, Button, Empty, Input, LayerCard, Table } from "@cloudflare/kumo";
import {
  CaretDown,
  CaretRight,
  CheckCircle,
  Cube,
  Database,
  MagnifyingGlass,
  Warning,
  WarningCircle,
} from "@phosphor-icons/react";
import type { OptionAuditReport } from "@volumetric/canister-types";
import { unwrapResult } from "@volumetric/canister-types";
import { useCallback, useMemo, useState } from "react";
import { CopyButton } from "../components/CopyButton";
import { Eyebrow } from "../components/Eyebrow";
import { MetricCard } from "../components/MetricCard";
import { Mono } from "../components/Mono";
import { PageShell } from "../components/PageShell";
import {
  formatDollarsFromCents,
  PredictionSummaryMetrics,
  PredictionsTable,
} from "../components/PayoutPredictionResults";
import { accountKey, type LedgerAccount } from "../lib/account";
import {
  accountLabel,
  buildExpectedTransferRows,
  type ExpectedTransferAuditRow,
  toLedgerAccount,
} from "../lib/audit";
import { type AccountTransaction, getAllAccountTransactions } from "../lib/ckbtc-index";
import { useCreateCanisterClients } from "../lib/clients";
import { bytesToHex, formatSats, principalText, shortPrincipal } from "../lib/format";
import { predictPayouts } from "../lib/settlement-math";
import { useAsyncAction } from "../lib/use-async-action";

const DEFAULT_MAX_RESULTS = 100;
const OPTION_AUDIT_MAX_PAGES = 5;

type OptionAuditData = {
  report: OptionAuditReport;
  rows: ExpectedTransferAuditRow[];
  accountsToQuery: Map<string, LedgerAccount>;
  rawTransactions: AccountTransaction[];
  relatedTransactionCount: number;
  icrc1TransferFeeSats: bigint;
};

export function OptionAuditPage() {
  const createClients = useCreateCanisterClients();
  const [optionId, setOptionId] = useState("");

  const action = useAsyncAction<OptionAuditData>({
    loadingStatus: "Loading option audit...",
    successStatus: (result) =>
      `Loaded option ${result.report.option_id} and ${result.relatedTransactionCount} related ledger transactions.`,
  });

  async function runAudit() {
    const parsedOptionId = Number.parseInt(optionId, 10);
    if (!Number.isSafeInteger(parsedOptionId) || parsedOptionId <= 0) {
      throw new Error("Enter a valid option id.");
    }

    await action.run(async () => {
      const { volumetric, ckBtcIndex, ckBtcLedger } = createClients();
      const [report, icrc1TransferFeeSats] = await Promise.all([
        unwrapResult(await volumetric.get_option_audit_report(BigInt(parsedOptionId))),
        ckBtcLedger.icrc1_fee(),
      ]);
      const accountsToQuery = new Map(
        report.expected_transfers.map((expectedTransfer) => {
          const account = toLedgerAccount(expectedTransfer.to);
          return [accountKey(account), account] as const;
        }),
      );
      const transactionPages = await Promise.all(
        Array.from(accountsToQuery.values()).map((account) =>
          getAllAccountTransactions({
            indexClient: ckBtcIndex,
            account,
            maxResults: DEFAULT_MAX_RESULTS,
            maxPages: OPTION_AUDIT_MAX_PAGES,
          }),
        ),
      );
      const transactions = transactionPages.flatMap((page) => page.transactions);

      return {
        report,
        rows: buildExpectedTransferRows(report, transactions),
        accountsToQuery,
        rawTransactions: transactions,
        relatedTransactionCount: transactions.length,
        icrc1TransferFeeSats,
      };
    });
  }

  async function handleSubmit() {
    try {
      await runAudit();
    } catch {
      /* handled via action.error */
    }
  }

  const settlementPayoutModel = useMemo(() => {
    const option = action.data?.report.option[0];
    const settlement = action.data?.report.settlement[0];
    if (!option || !action.data || !settlement) {
      return null;
    }
    return predictPayouts({
      options: [option],
      settlementPriceCents: settlement.settlement_price_cents,
      profitFeeBasisPoints: option.profit_fee_basis_points,
      icrc1TransferFeeSats: action.data.icrc1TransferFeeSats,
    });
  }, [action.data]);

  return (
    <PageShell
      eyebrow="Accounting / Options"
      title="Expected vs On-chain Transfers"
      description="Verify that every settlement transfer the canister owes for a specific option id actually landed on the ckBTC ledger."
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
          Audit option
        </Button>
      }
    >
      <div className="max-w-sm">
        <Input
          label="Option id"
          placeholder="e.g. 42"
          value={optionId}
          onChange={(event) => setOptionId(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              void handleSubmit();
            }
          }}
        />
      </div>

      <OptionSummary report={action.data?.report ?? null} />
      {action.data?.report.option[0] ? (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-kumo-primary">Settlement payout model</h2>
          {action.data.report.settlement[0] ? (
            <>
              <p className="text-sm text-kumo-inactive max-w-3xl">
                Same math as Payout Predictor at the recorded settlement price{" "}
                {formatDollarsFromCents(action.data.report.settlement[0].settlement_price_cents)}.
                Uses this option&apos;s profit fee (
                {action.data.report.option[0].profit_fee_basis_points.toString()} bp) and the
                current ICRC-1 transfer fee ({formatSats(action.data.icrc1TransferFeeSats)}).
              </p>
              {settlementPayoutModel ? (
                <>
                  <PredictionSummaryMetrics summary={settlementPayoutModel.summary} />
                  <PredictionsTable predictions={settlementPayoutModel.predictions} />
                </>
              ) : null}
            </>
          ) : (
            <Empty
              size="sm"
              title="No settlement price on record"
              description="Payout modeling appears once this option has a settlement entry in the audit report (settled options)."
            />
          )}
        </div>
      ) : null}
      <ExpectedTransferTable rows={action.data?.rows ?? []} />
      <RawTransactionsSection
        accountsToQuery={action.data?.accountsToQuery}
        transactions={action.data?.rawTransactions ?? []}
      />
    </PageShell>
  );
}

const SECONDS_PER_DAY = 86400;

function formatOptionalValue(value: string, fallback = "—"): string {
  return value || fallback;
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

  let strikePrice: string | null = null;
  let strikePercent: string | null = null;
  let premiumPercent: string | null = null;
  let termDays: string | null = null;

  if (option) {
    const entry = Number(option.entry_price_cents);
    const strike = Number(option.strike_price_cents);
    const quantity = Number(option.quantity);
    const premiumPaid = Number(option.premium_paid);
    const durationSeconds = Number(option.expiry_seconds - option.accepted_at_seconds);

    strikePrice = `$${(strike / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
    strikePercent = `${entry > 0 ? (((strike - entry) / entry) * 100).toFixed(1) : "0.0"}%`;
    premiumPercent = `${quantity > 0 ? ((premiumPaid / quantity) * 100).toFixed(2) : "0.00"}%`;
    termDays = `${Math.round(durationSeconds / SECONDS_PER_DAY)} days`;
  }

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
      <MetricCard label="Option id" value={report.option_id.toString()} />
      <MetricCard label="Strike price" value={formatOptionalValue(strikePrice)} />
      <MetricCard label="Strike %" value={formatOptionalValue(strikePercent)} />
      <MetricCard label="Premium %" value={formatOptionalValue(premiumPercent)} />
      <MetricCard label="Term" value={formatOptionalValue(termDays)} />
      <MetricCard label="Premium paid" value={formatSats(option?.premium_paid ?? 0n)} />
      <MetricCard
        label="Buyer"
        value={option ? shortPrincipal(option.buyer) : "unknown"}
        mono
        copyValue={option ? option.buyer.toText() : undefined}
      />
      <MetricCard
        label="Writer"
        value={option ? shortPrincipal(option.writer) : "unknown"}
        mono
        copyValue={option ? option.writer.toText() : undefined}
      />
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
    <LayerCard className="overflow-x-auto p-0">
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
                <Mono className="break-all text-sm">{accountLabel(row.to)}</Mono>
              </Table.Cell>
              <Table.Cell>
                <Mono className="break-all text-sm">
                  {row.matchedTransactionIds.map((id) => id.toString()).join(", ") || "—"}
                </Mono>
              </Table.Cell>
              <Table.Cell>
                <Mono className="break-all text-sm">{row.memoHex}</Mono>
              </Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table>
    </LayerCard>
  );
}

function RawTransactionsSection({
  accountsToQuery: _accountsToQuery,
  transactions,
}: {
  accountsToQuery: Map<string, LedgerAccount> | undefined;
  transactions: AccountTransaction[];
}) {
  const [showRawTransactions, setShowRawTransactions] = useState(false);
  const toggle = useCallback(() => setShowRawTransactions((prev) => !prev), []);
  const sortedTransactions = useMemo(
    () => [...transactions].sort((a, b) => Number(b.id - a.id)),
    [transactions],
  );

  if (transactions.length === 0) {
    return null;
  }

  return (
    <LayerCard>
      <button type="button" onClick={toggle} className="flex w-full items-center gap-2 text-left">
        {showRawTransactions ? (
          <CaretDown size={14} className="text-kumo-subtle" />
        ) : (
          <CaretRight size={14} className="text-kumo-subtle" />
        )}
        <Eyebrow>Raw ckBTC index transactions ({transactions.length})</Eyebrow>
      </button>

      {showRawTransactions ? (
        <div className="mt-4 max-h-[600px] overflow-y-auto">
          <table className="w-full text-xs font-mono">
            <thead>
              <tr className="border-b vol-hairline text-kumo-subtle">
                <th className="px-2 py-1 text-left">ID</th>
                <th className="px-2 py-1 text-left">Kind</th>
                <th className="px-2 py-1 text-right">Amount</th>
                <th className="px-2 py-1 text-left">From</th>
                <th className="px-2 py-1 text-left">To</th>
                <th className="px-2 py-1 text-left">Memo</th>
                <th className="px-2 py-1 text-left">Time</th>
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
                    <td className="px-2 py-1 whitespace-nowrap">{tx.id.toString()}</td>
                    <td className="px-2 py-1">
                      <Badge variant="neutral">{kind}</Badge>
                    </td>
                    <td className="px-2 py-1 text-right whitespace-nowrap">{formatSats(amount)}</td>
                    <td
                      className="max-w-[200px] truncate px-2 py-1"
                      title={fromAccount ? accountKey(fromAccount) : ""}
                    >
                      {fromAccount ? (
                        <CopyButton value={accountKey(fromAccount)}>
                          <span>{formatAccount(fromAccount)}</span>
                        </CopyButton>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td
                      className="max-w-[200px] truncate px-2 py-1"
                      title={toAccount ? accountKey(toAccount) : ""}
                    >
                      {toAccount ? (
                        <CopyButton value={accountKey(toAccount)}>
                          <span>{formatAccount(toAccount)}</span>
                        </CopyButton>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td
                      className="max-w-[160px] truncate px-2 py-1"
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
                    <td className="px-2 py-1 whitespace-nowrap">
                      {formatTimestamp(tx.transaction.timestamp)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </LayerCard>
  );
}

function formatAccount(account: LedgerAccount): string {
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
