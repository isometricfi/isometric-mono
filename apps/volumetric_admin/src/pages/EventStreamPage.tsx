import { Button, Empty, Input, LayerCard, Table, Tabs } from "@cloudflare/kumo";
import { Principal } from "@dfinity/principal";
import { ArrowsClockwise, ListChecks } from "@phosphor-icons/react";
import type { Event } from "@volumetric/canister-types";
import { unwrapResult } from "@volumetric/canister-types";
import { useState } from "react";
import { MetricCard } from "../components/MetricCard";
import { Mono } from "../components/Mono";
import { PageShell } from "../components/PageShell";
import { useCreateCanisterClients } from "../lib/clients";
import { shortPrincipal } from "../lib/format";
import { useAsyncAction } from "../lib/use-async-action";

const DEFAULT_PAGE_SIZE = 100;
const MAX_PAGE_SIZE = 500;

type EventsMode = "all" | "principal" | "since";

type EventsData = {
  events: Event[];
  mode: EventsMode;
};

export function EventStreamPage() {
  const createClients = useCreateCanisterClients();
  const [mode, setMode] = useState<EventsMode>("all");
  const [startOffset, setStartOffset] = useState<string>("");
  const [pageSizeInput, setPageSizeInput] = useState<string>(String(DEFAULT_PAGE_SIZE));
  const [principalInput, setPrincipalInput] = useState("");
  const [sinceEventIdInput, setSinceEventIdInput] = useState("");

  const action = useAsyncAction<EventsData>({
    loadingStatus: "Loading events...",
    successStatus: (result) => `Loaded ${result.events.length} events (${result.mode}).`,
  });

  async function runAudit() {
    const parsedPageSize = Number.parseInt(pageSizeInput, 10);
    if (
      !Number.isSafeInteger(parsedPageSize) ||
      parsedPageSize <= 0 ||
      parsedPageSize > MAX_PAGE_SIZE
    ) {
      throw new Error(`Page size must be between 1 and ${MAX_PAGE_SIZE}.`);
    }

    await action.run(async () => {
      const { volumetric } = createClients();
      if (mode === "all") {
        const parsedStart = startOffset.trim() === "" ? [] : [BigInt(startOffset.trim())];
        const events = unwrapResult(
          await volumetric.get_all_events(parsedStart as [] | [bigint], [parsedPageSize]),
        );
        return { events, mode };
      }
      if (mode === "principal") {
        if (!principalInput.trim()) throw new Error("Enter a principal.");
        const principal = Principal.fromText(principalInput.trim());
        const parsedStart = startOffset.trim() === "" ? [] : [BigInt(startOffset.trim())];
        const events = unwrapResult(
          await volumetric.get_events_for_principal(principal, parsedStart as [] | [bigint], [
            parsedPageSize,
          ]),
        );
        return { events, mode };
      }
      if (!sinceEventIdInput.trim()) throw new Error("Enter a since event id.");
      const events = unwrapResult(
        await volumetric.get_events_since(BigInt(sinceEventIdInput.trim()), [parsedPageSize]),
      );
      return { events, mode };
    });
  }

  async function handleSubmit() {
    try {
      await runAudit();
    } catch {
      /* handled */
    }
  }

  return (
    <PageShell
      eyebrow="Operations"
      title="Event Stream"
      description="Tail the canister's event log. Filter by all events, by a single principal, or fetch only events newer than a given id."
      phase={action.phase}
      statusText={action.statusText}
      error={action.error}
      action={
        <Button
          variant="primary"
          icon={<ArrowsClockwise />}
          loading={action.phase === "loading"}
          onClick={handleSubmit}
        >
          Load events
        </Button>
      }
    >
      <ModeTabs mode={mode} onChange={setMode} />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {mode === "principal" ? (
          <Input
            label="Principal"
            placeholder="aaaaa-..."
            value={principalInput}
            onChange={(event) => setPrincipalInput(event.target.value)}
          />
        ) : null}
        {mode === "since" ? (
          <Input
            label="Since event id"
            type="number"
            value={sinceEventIdInput}
            onChange={(event) => setSinceEventIdInput(event.target.value)}
          />
        ) : null}
        {mode !== "since" ? (
          <Input
            label="Start offset (optional)"
            type="number"
            value={startOffset}
            onChange={(event) => setStartOffset(event.target.value)}
          />
        ) : null}
        <Input
          label="Page size"
          type="number"
          value={pageSizeInput}
          onChange={(event) => setPageSizeInput(event.target.value)}
        />
      </div>

      {action.data ? (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            <MetricCard label="Events loaded" value={action.data.events.length.toString()} />
            <MetricCard label="Mode" value={action.data.mode} />
            <MetricCard
              label="Newest id"
              value={action.data.events[0]?.id.toString() ?? "—"}
              mono
            />
          </div>
          <EventsTable events={action.data.events} />
        </>
      ) : (
        <Empty
          size="sm"
          icon={<ListChecks size={36} className="text-kumo-inactive" />}
          title="No events loaded"
          description="Pick a mode and load events to start tailing the stream."
        />
      )}
    </PageShell>
  );
}

function ModeTabs({ mode, onChange }: { mode: EventsMode; onChange: (next: EventsMode) => void }) {
  const modes: { value: EventsMode; label: string }[] = [
    { value: "all", label: "All events" },
    { value: "principal", label: "By principal" },
    { value: "since", label: "Since id" },
  ];

  return (
    <Tabs
      variant="underline"
      tabs={modes}
      value={mode}
      onValueChange={(nextMode) => onChange(nextMode as EventsMode)}
    />
  );
}

function EventsTable({ events }: { events: Event[] }) {
  if (events.length === 0) {
    return (
      <Empty
        size="sm"
        icon={<ListChecks size={36} className="text-kumo-inactive" />}
        title="No events"
        description="The stream returned no events for this filter."
      />
    );
  }

  return (
    <LayerCard className="p-0">
      <Table>
        <Table.Header>
          <Table.Row>
            <Table.Head>ID</Table.Head>
            <Table.Head>Type</Table.Head>
            <Table.Head>Principal</Table.Head>
            <Table.Head>Time</Table.Head>
            <Table.Head>Summary</Table.Head>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {events.map((event) => (
            <Table.Row key={event.id.toString()}>
              <Table.Cell>
                <Mono>{event.id.toString()}</Mono>
              </Table.Cell>
              <Table.Cell>
                <Mono className="text-sm">{eventTypeLabel(event.event_type)}</Mono>
              </Table.Cell>
              <Table.Cell>
                <Mono className="text-sm">{shortPrincipal(event.principal)}</Mono>
              </Table.Cell>
              <Table.Cell>
                <Mono className="text-sm">{formatSeconds(event.timestamp_seconds)}</Mono>
              </Table.Cell>
              <Table.Cell>
                <Mono className="text-sm">{eventSummary(event)}</Mono>
              </Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table>
    </LayerCard>
  );
}

function eventTypeLabel(eventType: Event["event_type"]): string {
  return Object.keys(eventType)[0] ?? "Unknown";
}

function eventSummary(event: Event): string {
  const dataKey = Object.keys(event.data)[0] ?? "";
  const dataValue = (event.data as Record<string, unknown>)[dataKey];
  if (!dataValue || typeof dataValue !== "object") return dataKey;
  const entries = Object.entries(dataValue as Record<string, unknown>)
    .slice(0, 3)
    .map(([key, value]) => `${key}=${formatInlineValue(value)}`);
  return entries.join(" ");
}

function formatInlineValue(value: unknown): string {
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "string") return value.length > 20 ? `${value.slice(0, 18)}…` : value;
  if (typeof value === "number") return value.toString();
  if (Array.isArray(value)) return `[${value.length}]`;
  if (value && typeof value === "object" && "toText" in value) {
    return (value as { toText: () => string }).toText().slice(0, 12);
  }
  return "...";
}

function formatSeconds(seconds: bigint): string {
  if (seconds === 0n) return "unknown";
  return new Date(Number(seconds) * 1000).toLocaleString();
}
