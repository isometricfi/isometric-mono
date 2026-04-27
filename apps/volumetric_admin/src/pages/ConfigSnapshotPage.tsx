import { Button, Empty } from "@cloudflare/kumo";
import { ArrowsClockwise, Copy, FileCode } from "@phosphor-icons/react";
import type { Config, FeatureFlags, FeeConfig, TradingLimits } from "@volumetric/canister-types";
import { JsonBlock, stringifyWithBigInt } from "../components/JsonBlock";
import { MetricCard } from "../components/MetricCard";
import { PageShell } from "../components/PageShell";
import { useCreateCanisterClients } from "../lib/clients";
import { formatBasisPoints, formatSats, shortPrincipal } from "../lib/format";
import { useAsyncAction } from "../lib/use-async-action";

type ConfigSnapshot = {
  config: Config;
  feeConfig: FeeConfig;
  tradingLimits: TradingLimits;
  featureFlags: FeatureFlags;
};

export function ConfigSnapshotPage() {
  const createClients = useCreateCanisterClients();

  const action = useAsyncAction<ConfigSnapshot>({
    loadingStatus: "Fetching config snapshot...",
    successStatus: () => "Config snapshot loaded.",
  });

  async function runAudit() {
    await action.run(async () => {
      const { volumetric } = createClients();
      const [config, feeConfig, tradingLimits, featureFlags] = await Promise.all([
        volumetric.get_config(),
        volumetric.get_fee_config(),
        volumetric.get_trading_limits(),
        volumetric.get_feature_flags(),
      ]);
      return { config, feeConfig, tradingLimits, featureFlags };
    });
  }

  async function copySnapshot() {
    if (!action.data) return;
    const snapshot = stringifyWithBigInt(action.data);
    await navigator.clipboard.writeText(snapshot);
  }

  return (
    <PageShell
      eyebrow="Configuration"
      title="Config Snapshot"
      description="A single point-in-time dump of every configuration surface: network config, fee config, trading limits, and feature flags. Copy as JSON to archive as audit evidence."
      phase={action.phase}
      statusText={action.statusText}
      error={action.error}
      action={
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            icon={<Copy />}
            disabled={!action.data}
            onClick={copySnapshot}
          >
            Copy JSON
          </Button>
          <Button
            variant="primary"
            icon={<ArrowsClockwise />}
            loading={action.phase === "loading"}
            onClick={runAudit}
          >
            Refresh
          </Button>
        </div>
      }
    >
      {action.data ? (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <MetricCard
              label="BTC network"
              value={Object.keys(action.data.config.btc_network)[0] ?? "?"}
            />
            <MetricCard
              label="ckBTC ledger"
              value={shortPrincipal(action.data.config.ckbtc_ledger)}
              mono
            />
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
              label="Deposit amount"
              value={formatSats(action.data.tradingLimits.deposit_amount_sats)}
            />
            <MetricCard
              label="Withdraw amount"
              value={formatSats(action.data.tradingLimits.withdraw_amount_sats)}
            />
            <MetricCard
              label="Max offers per term"
              value={action.data.tradingLimits.max_offers_per_term.toString()}
            />
          </div>
          <JsonBlock value={action.data} maxHeight="520px" />
        </>
      ) : (
        <Empty
          size="sm"
          icon={<FileCode size={36} className="text-kumo-inactive" />}
          title="No snapshot loaded"
          description="Refresh to pull the full config surface as a single snapshot."
        />
      )}
    </PageShell>
  );
}
