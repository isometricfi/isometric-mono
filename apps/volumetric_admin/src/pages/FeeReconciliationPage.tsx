import { Button, Empty, InputArea, LayerCard, Table, Text } from "@cloudflare/kumo";
import { ArrowsClockwise, Coins } from "@phosphor-icons/react";
import type { Event, FeeConfig, OptionAuditReport } from "@volumetric/canister-types";
import { unwrapResult } from "@volumetric/canister-types";
import { Eyebrow } from "../components/Eyebrow";
import { MetricCard } from "../components/MetricCard";
import { Mono } from "../components/Mono";
import { PageShell } from "../components/PageShell";
import { defaultAccount } from "../lib/account";
import { buildExpectedTransferRows, sumIncomingTransfers } from "../lib/audit";
import { type AccountTransaction, getAllAccountTransactions } from "../lib/ckbtc-index";
import { type CanisterClients, useCreateCanisterClients } from "../lib/clients";
import { useConnection } from "../lib/connection-context";
import {
  bytesToHex,
  formatBasisPoints,
  formatSats,
  formatTimestampNs,
  shortPrincipal,
} from "../lib/format";
import { useAsyncAction } from "../lib/use-async-action";

const DEFAULT_MAX_RESULTS = 100;
const DEFAULT_MAX_PAGES = 25;
const EVENT_PAGE_SIZE = 1000;
const EVENT_MAX_PAGES = 25;
const MEMO_PREVIEW_LENGTH = 18;

type FeeTransactionContext = {
  optionIds: bigint[];
  step: string;
  note: string;
};

type FeeResult = {
  feeConfig: FeeConfig;
  platformFeesCollectedSats: bigint;
  feeRecipientLedgerBalanceSats: bigint;
  feeTransactions: AccountTransaction[];
  feeTransactionContexts: Map<string, FeeTransactionContext[]>;
  optionReportsLoaded: number;
};

export function FeeReconciliationPage() {
  const createClients = useCreateCanisterClients();
  const { knownProtocolCanisterIds, setKnownProtocolCanisterIds, knownProtocolCanisterIdList } =
    useConnection();

  const action = useAsyncAction<FeeResult>({
    initialStatus: "Idle",
    loadingStatus: "Loading fee recipient audit...",
    successStatus: (result) =>
      `Loaded ${result.feeTransactions.length} fee-recipient transactions.`,
  });

  async function runAudit() {
    await action.run(async () => {
      const { volumetric, ckBtcIndex, ckBtcLedger } = createClients();
      const feeConfig = unwrapResult(await volumetric.get_fee_config());
      const feeRecipientAccount = defaultAccount(feeConfig.fee_recipient);
      const [platformFeesCollectedResult, feeTransactionsPage, feeRecipientLedgerBalanceSats] =
        await Promise.all([
          volumetric.get_platform_fees_collected_total(),
          getAllAccountTransactions({
            indexClient: ckBtcIndex,
            account: feeRecipientAccount,
            maxResults: DEFAULT_MAX_RESULTS,
            maxPages: DEFAULT_MAX_PAGES,
          }),
          ckBtcLedger.icrc1_balance_of(feeRecipientAccount),
        ]);
      const auditEvents = await loadAllEvents(volumetric);
      const optionIds = uniqueOptionIdsFromEvents(auditEvents);
      const optionReports = await Promise.all(
        optionIds.map((optionId) =>
          volumetric.get_option_audit_report(optionId).then(unwrapResult),
        ),
      );

      const platformFeesCollectedSats = unwrapResult(platformFeesCollectedResult);

      return {
        feeConfig,
        platformFeesCollectedSats,
        feeRecipientLedgerBalanceSats,
        feeTransactions: feeTransactionsPage.transactions,
        feeTransactionContexts: buildFeeTransactionContexts(
          optionReports,
          feeTransactionsPage.transactions,
        ),
        optionReportsLoaded: optionReports.length,
      };
    });
  }

  const feeRecipientIncomingTotal =
    action.data === null
      ? 0n
      : sumIncomingTransfers({
          transactions: action.data.feeTransactions,
          toOwner: action.data.feeConfig.fee_recipient.toText(),
          fromOwners: knownProtocolCanisterIdList,
        });

  return (
    <PageShell
      eyebrow="Accounting / Fees"
      title="Platform Fee Reconciliation"
      description="Compare the canister's internal fee counter, the fee recipient's on-chain ckBTC balance, and known inbound transfers from protocol canisters."
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
          Load fees
        </Button>
      }
    >
      {action.data ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <MetricCard
            label="Fee recipient"
            value={shortPrincipal(action.data.feeConfig.fee_recipient)}
            mono
          />
          <MetricCard
            label="Premium fee"
            value={formatBasisPoints(action.data.feeConfig.premium_fee_basis_points)}
          />
          <MetricCard
            label="Profit fee"
            value={formatBasisPoints(action.data.feeConfig.profit_fee_basis_points)}
          />
          <MetricCard
            label="Ledger balance"
            value={formatSats(action.data.feeRecipientLedgerBalanceSats)}
          />
          <MetricCard
            label="Canister fee counter"
            value={formatSats(action.data.platformFeesCollectedSats)}
          />
          <MetricCard label="Known inbound total" value={formatSats(feeRecipientIncomingTotal)} />
          <MetricCard
            label="Option reports loaded"
            value={action.data.optionReportsLoaded.toString()}
          />
        </div>
      ) : (
        <Empty
          size="sm"
          icon={<Coins size={36} className="text-kumo-inactive" />}
          title="No fee data loaded"
          description="Load the fee recipient audit to inspect config, balances, and inbound totals."
        />
      )}

      <LayerCard className="rounded-none border vol-hairline p-5">
        <InputArea
          label="Known protocol canisters"
          description="Sum inbound transfers from these principals into the fee recipient."
          rows={3}
          value={knownProtocolCanisterIds}
          onChange={(event) => setKnownProtocolCanisterIds(event.target.value)}
        />
      </LayerCard>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <Eyebrow>Fee-recipient transfers</Eyebrow>
          <Eyebrow>{action.data?.feeTransactions.length ?? 0} loaded</Eyebrow>
        </div>
        <FeeTransactionTable
          transactions={action.data?.feeTransactions ?? []}
          contexts={action.data?.feeTransactionContexts ?? new Map()}
        />
      </div>
    </PageShell>
  );
}

function FeeTransactionTable({
  transactions,
  contexts,
}: {
  transactions: AccountTransaction[];
  contexts: Map<string, FeeTransactionContext[]>;
}) {
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
            <Table.Head>Step</Table.Head>
            <Table.Head>Option ids</Table.Head>
            <Table.Head>From</Table.Head>
            <Table.Head>Time</Table.Head>
            <Table.Head>Memo</Table.Head>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {transactions.map((accountTransaction) => {
            const transfer = accountTransaction.transaction.transfer[0];
            const transactionContexts = contexts.get(accountTransaction.id.toString()) ?? [];
            return (
              <Table.Row key={accountTransaction.id.toString()}>
                <Table.Cell>
                  <Mono className="text-sm">{accountTransaction.id.toString()}</Mono>
                </Table.Cell>
                <Table.Cell>
                  <Mono>{transfer ? formatSats(transfer.amount) : "—"}</Mono>
                </Table.Cell>
                <Table.Cell title={formatContextNotes(transactionContexts)}>
                  {formatContextSteps(transactionContexts)}
                </Table.Cell>
                <Table.Cell>
                  <Mono className="text-sm">{formatContextOptionIds(transactionContexts)}</Mono>
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

async function loadAllEvents(volumetric: CanisterClients["volumetric"]): Promise<Event[]> {
  const events: Event[] = [];
  let afterId: bigint | null = null;

  for (let pageIndex = 0; pageIndex < EVENT_MAX_PAGES; pageIndex += 1) {
    const page = unwrapResult(
      await volumetric.get_all_events(afterId === null ? [] : [afterId], [EVENT_PAGE_SIZE]),
    ) as Event[];
    if (page.length === 0) {
      break;
    }

    events.push(...page);
    afterId = page[page.length - 1]?.id ?? afterId;
    if (page.length < EVENT_PAGE_SIZE) {
      break;
    }
  }

  return events;
}

function uniqueOptionIdsFromEvents(events: Event[]): bigint[] {
  const optionIdsByKey = new Map<string, bigint>();

  for (const event of events) {
    const optionId = getEventOptionId(event);
    if (optionId === null) {
      continue;
    }

    optionIdsByKey.set(optionId.toString(), optionId);
  }

  return Array.from(optionIdsByKey.values());
}

function getEventOptionId(event: Event): bigint | null {
  if ("OfferAccepted" in event.data) {
    return event.data.OfferAccepted.option_id;
  }
  if ("OptionSettled" in event.data) {
    return event.data.OptionSettled.option_id;
  }
  if ("OptionSettlementFailed" in event.data) {
    return event.data.OptionSettlementFailed.option_id;
  }

  return null;
}

function buildFeeTransactionContexts(
  optionReports: OptionAuditReport[],
  feeTransactions: AccountTransaction[],
): Map<string, FeeTransactionContext[]> {
  const contexts = new Map<string, FeeTransactionContext[]>();

  for (const optionReport of optionReports) {
    const rows = buildExpectedTransferRows(optionReport, feeTransactions).filter(
      (row) => row.kind === "SettlementProfitFee" && row.matchedTransactionIds.length > 0,
    );

    for (const row of rows) {
      for (const transactionId of row.matchedTransactionIds) {
        const transactionKey = transactionId.toString();
        const existingContexts = contexts.get(transactionKey) ?? [];
        contexts.set(transactionKey, [
          ...existingContexts,
          {
            optionIds: [optionReport.option_id],
            step: "Settlement profit fee",
            note: row.note,
          },
        ]);
      }
    }
  }

  return contexts;
}

function formatContextSteps(contexts: FeeTransactionContext[]): string {
  if (contexts.length === 0) {
    return "Unmatched fee transfer";
  }

  return Array.from(new Set(contexts.map((context) => context.step))).join(", ");
}

function formatContextOptionIds(contexts: FeeTransactionContext[]): string {
  const optionIds = contexts.flatMap((context) => context.optionIds);
  if (optionIds.length === 0) {
    return "—";
  }

  return Array.from(new Set(optionIds.map((optionId) => optionId.toString()))).join(", ");
}

function formatContextNotes(contexts: FeeTransactionContext[]): string {
  if (contexts.length === 0) {
    return "No option-audit memo match. This may be an accept platform fee, an external transfer, or a transfer predating available audit context.";
  }

  return contexts.map((context) => context.note).join("\n");
}
