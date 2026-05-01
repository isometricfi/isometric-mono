import { Badge, Button, Empty, Input, LayerCard, Table } from "@cloudflare/kumo";
import {
  CheckCircle,
  Cube,
  Database,
  MagnifyingGlass,
  Warning,
  WarningCircle,
} from "@phosphor-icons/react";
import type { OptionAuditReport } from "@volumetric/canister-types";
import { unwrapResult } from "@volumetric/canister-types";
import { useState } from "react";
import { MetricCard } from "../components/MetricCard";
import { Mono } from "../components/Mono";
import { PageShell } from "../components/PageShell";
import { accountKey } from "../lib/account";
import {
  accountLabel,
  buildExpectedTransferRows,
  type ExpectedTransferAuditRow,
  toLedgerAccount,
} from "../lib/audit";
import { getAllAccountTransactions } from "../lib/ckbtc-index";
import { useCreateCanisterClients } from "../lib/clients";
import { formatSats, shortPrincipal } from "../lib/format";
import { useAsyncAction } from "../lib/use-async-action";

const DEFAULT_MAX_RESULTS = 100;
const OPTION_AUDIT_MAX_PAGES = 5;
const MEMO_PREVIEW_LENGTH = 18;

type OptionAuditData = {
  report: OptionAuditReport;
  rows: ExpectedTransferAuditRow[];
  relatedTransactionCount: number;
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
      const { volumetric, ckBtcIndex } = createClients();
      const report = unwrapResult(await volumetric.get_option_audit_report(BigInt(parsedOptionId)));
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
        relatedTransactionCount: transactions.length,
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
      <ExpectedTransferTable rows={action.data?.rows ?? []} />
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
      <MetricCard label="Buyer" value={option ? shortPrincipal(option.buyer) : "unknown"} mono />
      <MetricCard label="Writer" value={option ? shortPrincipal(option.writer) : "unknown"} mono />
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
