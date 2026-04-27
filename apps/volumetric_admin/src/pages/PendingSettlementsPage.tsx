import { Badge, Button, Empty, LayerCard, Table } from "@cloudflare/kumo";
import { ArrowsClockwise, Stack } from "@phosphor-icons/react";
import type { PendingSettlement } from "@volumetric/canister-types";
import { unwrapResult } from "@volumetric/canister-types";
import { MetricCard } from "../components/MetricCard";
import { Mono } from "../components/Mono";
import { PageShell } from "../components/PageShell";
import { useCreateCanisterClients } from "../lib/clients";
import { formatSats, shortPrincipal } from "../lib/format";
import { useAsyncAction } from "../lib/use-async-action";

const STUCK_THRESHOLD_SECONDS = 300;

type PendingSettlementsData = {
  journalEntries: PendingSettlement[];
  stuckCount: number;
  nowSeconds: bigint;
};

export function PendingSettlementsPage() {
  const createClients = useCreateCanisterClients();

  const action = useAsyncAction<PendingSettlementsData>({
    loadingStatus: "Fetching pending settlements journal...",
    successStatus: (result) =>
      `${result.journalEntries.length} pending entries (${result.stuckCount} stuck > ${STUCK_THRESHOLD_SECONDS}s).`,
  });

  async function runAudit() {
    await action.run(async () => {
      const { volumetric } = createClients();
      const journalEntries = unwrapResult(await volumetric.get_pending_settlements_journal());
      const nowSeconds = BigInt(Math.floor(Date.now() / 1000));
      const stuckCount = journalEntries.reduce((sum, entry) => {
        const ageSeconds = nowSeconds - entry.created_at_seconds;
        return ageSeconds > BigInt(STUCK_THRESHOLD_SECONDS) ? sum + 1 : sum;
      }, 0);
      return { journalEntries, stuckCount, nowSeconds };
    });
  }

  return (
    <PageShell
      eyebrow="Accounting"
      title="Pending Settlements"
      description="Settlements still in the journal. Each entry represents an option the canister has committed to pay out. Rows older than 5 minutes are flagged as stuck."
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
            <MetricCard
              label="Total pending"
              value={action.data.journalEntries.length.toString()}
            />
            <MetricCard
              label="Stuck (>5m)"
              value={action.data.stuckCount.toString()}
              tone={action.data.stuckCount > 0 ? "danger" : "ok"}
            />
            <MetricCard
              label="Owed to buyers"
              value={formatSats(
                action.data.journalEntries.reduce((sum, entry) => sum + entry.payout_to_buyer, 0n),
              )}
            />
          </div>
          <PendingSettlementsTable
            entries={action.data.journalEntries}
            nowSeconds={action.data.nowSeconds}
          />
        </>
      ) : (
        <Empty
          size="sm"
          icon={<Stack size={36} className="text-kumo-inactive" />}
          title="No data loaded"
          description="Refresh to pull the current pending-settlements journal."
        />
      )}
    </PageShell>
  );
}

function PendingSettlementsTable({
  entries,
  nowSeconds,
}: {
  entries: PendingSettlement[];
  nowSeconds: bigint;
}) {
  if (entries.length === 0) {
    return (
      <Empty
        size="sm"
        icon={<Stack size={36} className="text-kumo-inactive" />}
        title="Journal is empty"
        description="No pending settlements. All payouts have reached a terminal state."
      />
    );
  }

  const sortedEntries = [...entries].sort((a, b) =>
    b.created_at_seconds > a.created_at_seconds
      ? 1
      : b.created_at_seconds < a.created_at_seconds
        ? -1
        : 0,
  );

  return (
    <LayerCard className="p-0">
      <Table>
        <Table.Header>
          <Table.Row>
            <Table.Head>Option</Table.Head>
            <Table.Head>Phase</Table.Head>
            <Table.Head>Buyer</Table.Head>
            <Table.Head>Writer</Table.Head>
            <Table.Head>Payout buyer</Table.Head>
            <Table.Head>Payout writer</Table.Head>
            <Table.Head>Age</Table.Head>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {sortedEntries.map((entry) => {
            const ageSeconds = nowSeconds - entry.created_at_seconds;
            const isStuck = ageSeconds > BigInt(STUCK_THRESHOLD_SECONDS);
            return (
              <Table.Row key={entry.option_id.toString()}>
                <Table.Cell>
                  <Mono>{entry.option_id.toString()}</Mono>
                </Table.Cell>
                <Table.Cell>
                  <Mono className="text-sm">{phaseLabel(entry.phase)}</Mono>
                </Table.Cell>
                <Table.Cell>
                  <Mono className="text-sm">{shortPrincipal(entry.buyer)}</Mono>
                </Table.Cell>
                <Table.Cell>
                  <Mono className="text-sm">{shortPrincipal(entry.writer)}</Mono>
                </Table.Cell>
                <Table.Cell>
                  <Mono>{formatSats(entry.payout_to_buyer)}</Mono>
                </Table.Cell>
                <Table.Cell>
                  <Mono>{formatSats(entry.payout_to_writer)}</Mono>
                </Table.Cell>
                <Table.Cell>
                  {isStuck ? (
                    <Badge variant="error">{formatDuration(ageSeconds)}</Badge>
                  ) : (
                    <Mono className="text-sm">{formatDuration(ageSeconds)}</Mono>
                  )}
                </Table.Cell>
              </Table.Row>
            );
          })}
        </Table.Body>
      </Table>
    </LayerCard>
  );
}

function phaseLabel(phase: PendingSettlement["phase"]): string {
  return Object.keys(phase)[0] ?? "Unknown";
}

function formatDuration(seconds: bigint): string {
  const secondsNumber = Number(seconds);
  if (secondsNumber < 60) return `${secondsNumber}s`;
  if (secondsNumber < 3_600) return `${Math.floor(secondsNumber / 60)}m`;
  if (secondsNumber < 86_400) return `${Math.floor(secondsNumber / 3_600)}h`;
  return `${Math.floor(secondsNumber / 86_400)}d`;
}
