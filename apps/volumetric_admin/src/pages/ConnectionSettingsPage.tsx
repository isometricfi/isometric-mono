import { Input, InputArea, LayerCard } from "@cloudflare/kumo";
import { PageShell } from "../components/PageShell";
import { useConnection } from "../lib/connection-context";

export function ConnectionSettingsPage() {
  const {
    icHost,
    setIcHost,
    volumetricCanisterId,
    setVolumetricCanisterId,
    ckBtcIndexCanisterId,
    setCkBtcIndexCanisterId,
    ckBtcLedgerCanisterId,
    setCkBtcLedgerCanisterId,
    knownProtocolCanisterIds,
    setKnownProtocolCanisterIds,
  } = useConnection();

  return (
    <PageShell
      eyebrow="Configuration"
      title="Connection Settings"
      description="Endpoints used by every page in the console. Changes apply immediately to the next query — no restart needed."
      phase="idle"
      statusText="Read-only reads only"
    >
      <LayerCard className="rounded-none border vol-hairline p-0">
        <div className="grid grid-cols-1 gap-px bg-[color:var(--vol-hairline)] md:grid-cols-2">
          <div className="bg-kumo-base p-5">
            <Input
              label="IC host"
              value={icHost}
              onChange={(event) => setIcHost(event.target.value)}
            />
          </div>
          <div className="bg-kumo-base p-5">
            <Input
              label="Volumetric canister"
              value={volumetricCanisterId}
              onChange={(event) => setVolumetricCanisterId(event.target.value)}
            />
          </div>
          <div className="bg-kumo-base p-5">
            <Input
              label="ckBTC index canister"
              value={ckBtcIndexCanisterId}
              onChange={(event) => setCkBtcIndexCanisterId(event.target.value)}
            />
          </div>
          <div className="bg-kumo-base p-5">
            <Input
              label="ckBTC ledger canister"
              value={ckBtcLedgerCanisterId}
              onChange={(event) => setCkBtcLedgerCanisterId(event.target.value)}
            />
          </div>
        </div>
      </LayerCard>

      <LayerCard className="rounded-none border vol-hairline p-5">
        <InputArea
          label="Known protocol canisters"
          description="One principal per line. Used by Fee Reconciliation to sum known-inbound transfers."
          rows={4}
          value={knownProtocolCanisterIds}
          onChange={(event) => setKnownProtocolCanisterIds(event.target.value)}
        />
      </LayerCard>
    </PageShell>
  );
}
