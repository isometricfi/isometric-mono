import { Button, Empty, Input, LayerCard } from "@cloudflare/kumo";
import { ArrowsClockwise, Wrench } from "@phosphor-icons/react";
import { unwrapResult } from "@volumetric/canister-types";
import { useState } from "react";
import { MetricCard } from "../components/MetricCard";
import { PageShell } from "../components/PageShell";
import { useCreateCanisterClients } from "../lib/clients";
import { bytesToHex } from "../lib/format";
import { useAsyncAction } from "../lib/use-async-action";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 500;

type WalData = {
  limit: number;
  entries: Array<Uint8Array | number[]>;
};

export function WalRecoveryPage() {
  const createClients = useCreateCanisterClients();
  const [limitInput, setLimitInput] = useState(String(DEFAULT_LIMIT));

  const action = useAsyncAction<WalData>({
    loadingStatus: "Fetching WAL recovery entries...",
    successStatus: (result) =>
      `${result.entries.length} recovery-required entries (limit ${result.limit}).`,
  });

  async function runAudit() {
    const parsedLimit = Number.parseInt(limitInput, 10);
    if (!Number.isSafeInteger(parsedLimit) || parsedLimit <= 0 || parsedLimit > MAX_LIMIT) {
      throw new Error(`Enter a limit between 1 and ${MAX_LIMIT}.`);
    }

    await action.run(async () => {
      const { volumetric } = createClients();
      const entries = unwrapResult(await volumetric.get_recovery_required_wal_entries(parsedLimit));
      return { limit: parsedLimit, entries };
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
      title="WAL Recovery"
      description="Raw write-ahead-log entries currently flagged as recovery-required. Each entry is a binary operation blob that needs manual reconciliation or replay."
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
          Fetch entries
        </Button>
      }
    >
      <div className="max-w-[160px]">
        <Input
          label="Limit"
          type="number"
          value={limitInput}
          onChange={(event) => setLimitInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") void handleSubmit();
          }}
        />
      </div>

      {action.data ? (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            <MetricCard
              label="Entries"
              value={action.data.entries.length.toString()}
              tone={action.data.entries.length > 0 ? "warn" : "ok"}
            />
            <MetricCard label="Limit" value={action.data.limit.toString()} />
          </div>
          <WalEntriesList entries={action.data.entries} />
        </>
      ) : (
        <Empty
          size="sm"
          icon={<Wrench size={36} className="text-kumo-inactive" />}
          title="No data loaded"
          description="Fetch to inspect the current WAL recovery queue."
        />
      )}
    </PageShell>
  );
}

function WalEntriesList({ entries }: { entries: Array<Uint8Array | number[]> }) {
  if (entries.length === 0) {
    return (
      <Empty
        size="sm"
        icon={<Wrench size={36} className="text-kumo-inactive" />}
        title="WAL is clean"
        description="No recovery-required entries at this limit."
      />
    );
  }

  return (
    <LayerCard className="rounded-none p-0">
      <pre className="max-h-[520px] overflow-auto p-4 text-[11px] leading-relaxed text-kumo-default">
        {entries
          .map(
            (entry, entryIndex) =>
              `#${entryIndex.toString().padStart(3, "0")}  ${bytesToHex(entry)}`,
          )
          .join("\n")}
      </pre>
    </LayerCard>
  );
}
