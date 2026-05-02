import { Button, Empty, LayerCard, Table } from "@cloudflare/kumo";
import { ArrowsClockwise, WarningOctagon } from "@phosphor-icons/react";
import type {
  PendingAccept,
  PendingSettlement,
  PendingWithdrawal,
} from "@volumetric/canister-types";
import { unwrapResult } from "@volumetric/canister-types";
import { Eyebrow } from "../components/Eyebrow";
import { MetricCard } from "../components/MetricCard";
import { Mono } from "../components/Mono";
import { PageShell } from "../components/PageShell";
import { useCreateCanisterClients } from "../lib/clients";
import { formatSats, formatUnixSecondsUtc, shortPrincipal } from "../lib/format";
import { useAsyncAction } from "../lib/use-async-action";

type FailedData = {
  failedSettlements: PendingSettlement[];
  failedAccepts: PendingAccept[];
  failedWithdrawals: PendingWithdrawal[];
};

export function FailedOperationsPage() {
  const createClients = useCreateCanisterClients();

  const action = useAsyncAction<FailedData>({
    loadingStatus: "Fetching failed queues...",
    successStatus: (result) =>
      `${result.failedSettlements.length} settlements, ${result.failedAccepts.length} accepts, ${result.failedWithdrawals.length} withdrawals failed.`,
  });

  async function runAudit() {
    await action.run(async () => {
      const { volumetric } = createClients();
      const [failedSettlements, failedAccepts, failedWithdrawals] = await Promise.all([
        volumetric.get_failed_settlements().then(unwrapResult),
        volumetric.get_failed_accepts().then(unwrapResult),
        volumetric.get_failed_withdrawals().then(unwrapResult),
      ]);
      return { failedSettlements, failedAccepts, failedWithdrawals };
    });
  }

  return (
    <PageShell
      eyebrow="Operations"
      title="Failed Operations"
      description="Operations that exited into a terminal failure state. Every row here needs human attention."
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
          <div className="grid grid-cols-3 gap-3">
            <MetricCard
              label="Failed settlements"
              value={action.data.failedSettlements.length.toString()}
              tone={action.data.failedSettlements.length > 0 ? "danger" : "ok"}
            />
            <MetricCard
              label="Failed accepts"
              value={action.data.failedAccepts.length.toString()}
              tone={action.data.failedAccepts.length > 0 ? "danger" : "ok"}
            />
            <MetricCard
              label="Failed withdrawals"
              value={action.data.failedWithdrawals.length.toString()}
              tone={action.data.failedWithdrawals.length > 0 ? "danger" : "ok"}
            />
          </div>

          <FailedSettlementsSection entries={action.data.failedSettlements} />
          <FailedAcceptsSection entries={action.data.failedAccepts} />
          <FailedWithdrawalsSection entries={action.data.failedWithdrawals} />
        </>
      ) : (
        <Empty
          size="sm"
          icon={<WarningOctagon size={36} className="text-kumo-inactive" />}
          title="No data loaded"
          description="Refresh to pull failed operations across all three queues."
        />
      )}
    </PageShell>
  );
}

function FailedSettlementsSection({ entries }: { entries: PendingSettlement[] }) {
  return (
    <SectionShell label="Failed settlements" count={entries.length}>
      {entries.length === 0 ? (
        <EmptySection message="No failed settlements." />
      ) : (
        <LayerCard className="p-0">
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.Head>Option</Table.Head>
                <Table.Head>Updated (UTC)</Table.Head>
                <Table.Head>Reason</Table.Head>
                <Table.Head>Buyer</Table.Head>
                <Table.Head>Writer</Table.Head>
                <Table.Head>Payout buyer</Table.Head>
                <Table.Head>Payout writer</Table.Head>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {entries.map((entry) => (
                <Table.Row key={entry.option_id.toString()}>
                  <Table.Cell>
                    <Mono>{entry.option_id.toString()}</Mono>
                  </Table.Cell>
                  <Table.Cell>
                    <Mono className="text-xs whitespace-nowrap">
                      {formatUnixSecondsUtc(entry.updated_at_seconds)}
                    </Mono>
                  </Table.Cell>
                  <Table.Cell>
                    <Mono className="text-sm">{extractPhaseReason(entry.phase)}</Mono>
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
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        </LayerCard>
      )}
    </SectionShell>
  );
}

function FailedAcceptsSection({ entries }: { entries: PendingAccept[] }) {
  return (
    <SectionShell label="Failed accepts" count={entries.length}>
      {entries.length === 0 ? (
        <EmptySection message="No failed accept-offers operations." />
      ) : (
        <LayerCard className="p-0">
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.Head>Fill group</Table.Head>
                <Table.Head>Updated (UTC)</Table.Head>
                <Table.Head>Buyer</Table.Head>
                <Table.Head>Reason</Table.Head>
                <Table.Head>Debit required</Table.Head>
                <Table.Head>Offers</Table.Head>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {entries.map((entry) => (
                <Table.Row key={entry.id.toString()}>
                  <Table.Cell>
                    <Mono>{entry.fill_group_id.toString()}</Mono>
                  </Table.Cell>
                  <Table.Cell>
                    <Mono className="text-xs whitespace-nowrap">
                      {formatUnixSecondsUtc(entry.updated_at_seconds)}
                    </Mono>
                  </Table.Cell>
                  <Table.Cell>
                    <Mono className="text-sm">{shortPrincipal(entry.buyer)}</Mono>
                  </Table.Cell>
                  <Table.Cell>
                    <Mono className="text-sm">{extractPhaseReason(entry.phase)}</Mono>
                  </Table.Cell>
                  <Table.Cell>
                    <Mono>{formatSats(entry.total_buyer_debit_required_sats)}</Mono>
                  </Table.Cell>
                  <Table.Cell>
                    <Mono className="text-sm">{entry.offers.length}</Mono>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        </LayerCard>
      )}
    </SectionShell>
  );
}

function FailedWithdrawalsSection({ entries }: { entries: PendingWithdrawal[] }) {
  return (
    <SectionShell label="Failed withdrawals" count={entries.length}>
      {entries.length === 0 ? (
        <EmptySection message="No failed withdrawals." />
      ) : (
        <LayerCard className="p-0">
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.Head>ID</Table.Head>
                <Table.Head>Updated (UTC)</Table.Head>
                <Table.Head>Principal</Table.Head>
                <Table.Head>Amount</Table.Head>
                <Table.Head>Reason</Table.Head>
                <Table.Head>BTC address</Table.Head>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {entries.map((entry) => (
                <Table.Row key={entry.id.toString()}>
                  <Table.Cell>
                    <Mono>{entry.id.toString()}</Mono>
                  </Table.Cell>
                  <Table.Cell>
                    <Mono className="text-xs whitespace-nowrap">
                      {formatUnixSecondsUtc(entry.updated_at_seconds)}
                    </Mono>
                  </Table.Cell>
                  <Table.Cell>
                    <Mono className="text-sm">{shortPrincipal(entry.principal)}</Mono>
                  </Table.Cell>
                  <Table.Cell>
                    <Mono>{formatSats(entry.amount)}</Mono>
                  </Table.Cell>
                  <Table.Cell>
                    <Mono className="text-sm">{extractPhaseReason(entry.phase)}</Mono>
                  </Table.Cell>
                  <Table.Cell>
                    <Mono className="text-sm">{entry.btc_address}</Mono>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        </LayerCard>
      )}
    </SectionShell>
  );
}

function SectionShell({
  label,
  count,
  children,
}: {
  label: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <LayerCard className="flex flex-col gap-3 rounded-none border vol-hairline p-4">
      <div className="flex items-center justify-between">
        <Eyebrow>{label}</Eyebrow>
        <Eyebrow>{count} entries</Eyebrow>
      </div>
      {children}
    </LayerCard>
  );
}

function EmptySection({ message }: { message: string }) {
  return <p className="py-2 text-[13px] text-kumo-subtle">{message}</p>;
}

function extractPhaseReason(phase: { Failed?: { reason: string } } | unknown): string {
  if (phase && typeof phase === "object" && "Failed" in phase) {
    const failed = (phase as { Failed: { reason: string } }).Failed;
    return failed?.reason ?? "Failed";
  }
  if (phase && typeof phase === "object") {
    return Object.keys(phase)[0] ?? "Unknown";
  }
  return "Unknown";
}
