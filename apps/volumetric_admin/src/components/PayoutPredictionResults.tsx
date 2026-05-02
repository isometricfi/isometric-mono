import { Badge, Empty, LayerCard, Table } from "@cloudflare/kumo";
import { Calculator } from "@phosphor-icons/react";
import { formatSats, shortPrincipal } from "../lib/format";
import type { OptionPrediction, PredictionSummary } from "../lib/settlement-math";
import { MetricCard } from "./MetricCard";
import { Mono } from "./Mono";

const CENTS_PER_DOLLAR = 100n;

export function formatDollarsFromCents(cents: bigint): string {
  const dollars = Number(cents) / Number(CENTS_PER_DOLLAR);
  return `$${dollars.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

export function PredictionSummaryMetrics({ summary }: { summary: PredictionSummary }) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
      <MetricCard
        label="Settlement price"
        value={formatDollarsFromCents(summary.predictedSettlementPriceCents)}
      />
      <MetricCard label="Active options" value={summary.optionCount.toString()} />
      <MetricCard
        label="ITM"
        value={summary.itmCount.toString()}
        tone={summary.itmCount > 0 ? "warn" : "default"}
      />
      <MetricCard label="OTM" value={(summary.optionCount - summary.itmCount).toString()} />
      <MetricCard label="Total buyer net" value={formatSats(summary.totalNetBuyerPayoutSats)} />
      <MetricCard label="Total writer net" value={formatSats(summary.totalNetWriterPayoutSats)} />
      <MetricCard label="Total platform fee" value={formatSats(summary.totalProfitFeeSats)} />
      <MetricCard
        label="Total transfer fees"
        value={formatSats(summary.totalTransferFeeTotalSats)}
      />
    </div>
  );
}

export function PredictionsTable({ predictions }: { predictions: OptionPrediction[] }) {
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
