import { Badge, Button, Empty, Input, LayerCard, Table } from "@cloudflare/kumo";
import { ArrowsClockwise, Calculator } from "@phosphor-icons/react";
import type { ActiveOption, FeeConfig } from "@volumetric/canister-types";
import { useState } from "react";
import { MetricCard } from "../components/MetricCard";
import { Mono } from "../components/Mono";
import { PageShell } from "../components/PageShell";
import { useCreateCanisterClients } from "../lib/clients";
import { formatSats, shortPrincipal } from "../lib/format";
import {
  type OptionPrediction,
  type PredictionSummary,
  predictPayouts,
} from "../lib/settlement-math";
import { useAsyncAction } from "../lib/use-async-action";

const CENTS_PER_DOLLAR = 100n;
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

      const [activeOptions, feeConfig, icrc1TransferFeeSats] = await Promise.all([
        volumetric.get_active_options(),
        volumetric.get_fee_config(),
        ckBtcLedger.icrc1_fee(),
      ]);

      const settlementPriceCents = BigInt(Math.round(priceDollars * Number(CENTS_PER_DOLLAR)));

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
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
            <MetricCard
              label="Settlement price"
              value={formatDollarsFromCents(action.data.summary.predictedSettlementPriceCents)}
            />
            <MetricCard label="Active options" value={action.data.summary.optionCount.toString()} />
            <MetricCard
              label="ITM"
              value={action.data.summary.itmCount.toString()}
              tone={action.data.summary.itmCount > 0 ? "warn" : "default"}
            />
            <MetricCard
              label="OTM"
              value={(action.data.summary.optionCount - action.data.summary.itmCount).toString()}
            />
            <MetricCard
              label="Total buyer net"
              value={formatSats(action.data.summary.totalNetBuyerPayoutSats)}
            />
            <MetricCard
              label="Total writer net"
              value={formatSats(action.data.summary.totalNetWriterPayoutSats)}
            />
            <MetricCard
              label="Total platform fee"
              value={formatSats(action.data.summary.totalProfitFeeSats)}
            />
            <MetricCard
              label="Total transfer fees"
              value={formatSats(action.data.summary.totalTransferFeeTotalSats)}
            />
          </div>
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

function formatDollarsFromCents(cents: bigint): string {
  const dollars = Number(cents) / Number(CENTS_PER_DOLLAR);
  return `$${dollars.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function PredictionsTable({ predictions }: { predictions: OptionPrediction[] }) {
  if (predictions.length === 0) {
    return (
      <Empty
        size="sm"
        icon={<Calculator size={36} className="text-kumo-inactive" />}
        title="No active options"
        description="There are no active options to predict against."
      />
    );
  }

  const sortedPredictions = [...predictions].sort((a, b) => {
    if (b.quantitySats > a.quantitySats) return 1;
    if (b.quantitySats < a.quantitySats) return -1;
    return 0;
  });

  return (
    <LayerCard className="p-0">
      <Table>
        <Table.Header>
          <Table.Row>
            <Table.Head>Option</Table.Head>
            <Table.Head>Status</Table.Head>
            <Table.Head>Buyer</Table.Head>
            <Table.Head>Writer</Table.Head>
            <Table.Head>Collateral</Table.Head>
            <Table.Head>Strike</Table.Head>
            <Table.Head>Buyer net</Table.Head>
            <Table.Head>Writer net</Table.Head>
            <Table.Head>Platform fee</Table.Head>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {sortedPredictions.map((prediction) => (
            <Table.Row key={prediction.optionId.toString()}>
              <Table.Cell>
                <Mono>{prediction.optionId.toString()}</Mono>
              </Table.Cell>
              <Table.Cell>
                {prediction.isInTheMoney ? (
                  <Badge variant="success">ITM</Badge>
                ) : (
                  <Badge variant="neutral">OTM</Badge>
                )}
              </Table.Cell>
              <Table.Cell>
                <Mono className="text-sm">{shortPrincipal(prediction.buyer)}</Mono>
              </Table.Cell>
              <Table.Cell>
                <Mono className="text-sm">{shortPrincipal(prediction.writer)}</Mono>
              </Table.Cell>
              <Table.Cell>
                <Mono>{formatSats(prediction.quantitySats)}</Mono>
              </Table.Cell>
              <Table.Cell>
                <Mono>{formatDollarsFromCents(prediction.strikePriceCents)}</Mono>
              </Table.Cell>
              <Table.Cell>
                <Mono>{formatSats(prediction.netBuyerPayoutSats)}</Mono>
              </Table.Cell>
              <Table.Cell>
                <Mono>{formatSats(prediction.netWriterPayoutSats)}</Mono>
              </Table.Cell>
              <Table.Cell>
                <Mono>{formatSats(prediction.profitFeeSats)}</Mono>
              </Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table>
    </LayerCard>
  );
}
