import { Button, Empty, Input } from "@cloudflare/kumo";
import { ArrowsClockwise, Calculator } from "@phosphor-icons/react";
import type { ActiveOption, FeeConfig } from "@volumetric/canister-types";
import { unwrapResult } from "@volumetric/canister-types";
import { useState } from "react";
import { PageShell } from "../components/PageShell";
import {
  formatDollarsFromCents,
  PredictionSummaryMetrics,
  PredictionsTable,
} from "../components/PayoutPredictionResults";
import { useCreateCanisterClients } from "../lib/clients";
import { formatSats } from "../lib/format";
import {
  type OptionPrediction,
  type PredictionSummary,
  predictPayouts,
} from "../lib/settlement-math";
import { useAsyncAction } from "../lib/use-async-action";

const DEFAULT_BTC_PRICE_USD = "100000";

type PredictorData = {
  activeOptions: ActiveOption[];
  feeConfig: FeeConfig;
  icrc1TransferFeeSats: bigint;
  predictions: OptionPrediction[];
  summary: PredictionSummary;
};

export function PayoutPredictorPage() {
  const createClients = useCreateCanisterClients();
  const [btcPriceUsd, setBtcPriceUsd] = useState(DEFAULT_BTC_PRICE_USD);

  const action = useAsyncAction<PredictorData>({
    loadingStatus: "Loading options and fee config...",
    successStatus: (result) =>
      `${result.activeOptions.length} active options predicted at ${formatDollarsFromCents(result.summary.predictedSettlementPriceCents)}. ${result.summary.itmCount} ITM.`,
  });

  async function runPrediction() {
    const priceDollars = Number.parseFloat(btcPriceUsd);
    if (!Number.isFinite(priceDollars) || priceDollars <= 0) {
      throw new Error("Enter a valid BTC price in USD.");
    }

    await action.run(async () => {
      const { volumetric, ckBtcLedger } = createClients();

      const [activeOptions, feeConfigResult, icrc1TransferFeeSats] = await Promise.all([
        volumetric.get_active_options(),
        volumetric.get_fee_config(),
        ckBtcLedger.icrc1_fee(),
      ]);
      const feeConfig = unwrapResult(feeConfigResult);

      const settlementPriceCents = BigInt(Math.round(priceDollars * 100));

      const { predictions, summary } = predictPayouts({
        options: activeOptions,
        settlementPriceCents,
        profitFeeBasisPoints: feeConfig.profit_fee_basis_points,
        icrc1TransferFeeSats,
      });

      return { activeOptions, feeConfig, icrc1TransferFeeSats, predictions, summary };
    });
  }

  async function handleSubmit() {
    try {
      await runPrediction();
    } catch {
      /* handled via action.error */
    }
  }

  return (
    <PageShell
      eyebrow="Accounting"
      title="Payout Predictor"
      description="Enter a predicted BTC settlement price to simulate payouts across all active options. See what each buyer, writer, and the platform would receive at that price. Buyer payouts are net of profit fees; writer payouts are net of ICRC-1 transfer fees."
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
          Predict
        </Button>
      }
    >
      <div className="max-w-xs">
        <Input
          label="BTC price (USD)"
          placeholder="e.g. 100000"
          value={btcPriceUsd}
          onChange={(event) => setBtcPriceUsd(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              void handleSubmit();
            }
          }}
        />
      </div>

      {action.data ? (
        <>
          <PredictionSummaryMetrics summary={action.data.summary} />
          <PredictionsTable predictions={action.data.predictions} />
          <p className="text-sm text-kumo-inactive">
            ICRC-1 transfer fee (ledger): {formatSats(action.data.icrc1TransferFeeSats)}. Writer
            payouts are net of transfer fees deducted during settlement WAL execution. Buyer payouts
            are net of the platform profit fee (
            {action.data.feeConfig.profit_fee_basis_points.toString()} bp).
          </p>
        </>
      ) : (
        <Empty
          size="sm"
          icon={<Calculator size={36} className="text-kumo-inactive" />}
          title="No predictions yet"
          description="Enter a BTC price and click predict to simulate settlement payouts across all active options."
        />
      )}
    </PageShell>
  );
}
