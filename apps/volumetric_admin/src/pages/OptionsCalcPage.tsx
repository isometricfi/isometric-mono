import { Button, Empty, Input, LayerCard } from "@cloudflare/kumo";
import { Calculator, Equals } from "@phosphor-icons/react";
import { useState } from "react";
import { MetricCard } from "../components/MetricCard";
import { PageShell } from "../components/PageShell";
import {
  BPS_DENOMINATOR,
  DEFAULT_CKBTC_TRANSFER_FEE_SATS,
  DEFAULT_PREMIUM_FEE_BPS,
  DEFAULT_PROFIT_FEE_BPS,
  type OptionsCalcResults,
  calculateOptions,
  dollarsToCents,
  formatBpsDisplay,
  formatDollarsFromCents,
  formatSatsDisplay,
} from "../lib/options-calc";

const DEFAULT_ENTRY_PRICE = "79514";
const DEFAULT_STRIKE_BPS = "300";
const DEFAULT_Q_SATS = "14200";
const DEFAULT_PREMIUM_BPS = "100";
const DEFAULT_SETTLEMENT_PRICE = "100000";

function parseBigintOrThrow(value: string, label: string): bigint {
  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) {
    throw new Error(`${label} must be a non-negative integer.`);
  }
  const parsed = BigInt(trimmed);
  if (parsed < 0n) {
    throw new Error(`${label} must be non-negative.`);
  }
  return parsed;
}

export function OptionsCalcPage() {
  const [entryPrice, setEntryPrice] = useState(DEFAULT_ENTRY_PRICE);
  const [strikeBps, setStrikeBps] = useState(DEFAULT_STRIKE_BPS);
  const [qSats, setQSats] = useState(DEFAULT_Q_SATS);
  const [premiumBps, setPremiumBps] = useState(DEFAULT_PREMIUM_BPS);
  const [settlementPrice, setSettlementPrice] = useState(DEFAULT_SETTLEMENT_PRICE);

  const [premiumFeeBps, setPremiumFeeBps] = useState(DEFAULT_PREMIUM_FEE_BPS.toString());
  const [profitFeeBps, setProfitFeeBps] = useState(DEFAULT_PROFIT_FEE_BPS.toString());
  const [transferFeeSats, setTransferFeeSats] = useState(DEFAULT_CKBTC_TRANSFER_FEE_SATS.toString());

  const [results, setResults] = useState<OptionsCalcResults | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleCalculate() {
    try {
      const entryPriceCents = dollarsToCents(entryPrice);
      const strikeBpsValue = parseBigintOrThrow(strikeBps, "Strike bps");
      const optionSizeSatsValue = parseBigintOrThrow(qSats, "Option size");
      const premiumBpsValue = parseBigintOrThrow(premiumBps, "Premium bps");
      const settlementPriceCents = dollarsToCents(settlementPrice);
      const premiumFeeBpsValue = parseBigintOrThrow(premiumFeeBps, "Premium fee bps");
      const profitFeeBpsValue = parseBigintOrThrow(profitFeeBps, "Profit fee bps");
      const transferFeeSatsValue = parseBigintOrThrow(transferFeeSats, "Transfer fee");

      const calcResults = calculateOptions({
        entryPriceCents,
        strikeBps: strikeBpsValue,
        optionSizeSats: optionSizeSatsValue,
        premiumBps: premiumBpsValue,
        settlementPriceCents,
        premiumFeeBps: premiumFeeBpsValue,
        profitFeeBps: profitFeeBpsValue,
        ckbtcTransferFeeSats: transferFeeSatsValue,
      });

      setResults(calcResults);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Calculation failed.");
      setResults(null);
    }
  }

  const hasResults = results !== null;

  return (
    <PageShell
      eyebrow="Accounting"
      title="Options Calculator"
      description="Calculate strike price, premiums, payouts, and fees for a single option. All amounts use integer math (floor division) matching on-chain computations. Fee config is pre-populated with defaults and can be overridden."
      phase={error ? "error" : "idle"}
      statusText={error ?? "Enter values and click Calculate"}
      error={error}
      action={
        <Button
          variant="primary"
          icon={<Equals />}
          onClick={handleCalculate}
        >
          Calculate
        </Button>
      }
    >
      <LayerCard className="rounded-none border vol-hairline p-0">
        <div className="grid grid-cols-1 gap-px bg-[color:var(--vol-hairline)] md:grid-cols-3">
          <div className="bg-kumo-base p-5">
            <Input
              label="Entry price (USD)"
              placeholder="e.g. 79514"
              value={entryPrice}
              onChange={(event) => setEntryPrice(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") handleCalculate();
              }}
            />
          </div>
          <div className="bg-kumo-base p-5">
            <Input
              label="Strike bps"
              placeholder="e.g. 300"
              value={strikeBps}
              onChange={(event) => setStrikeBps(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") handleCalculate();
              }}
            />
          </div>
          <div className="bg-kumo-base p-5">
            <Input
              label="Settlement price (USD)"
              placeholder="e.g. 100000"
              value={settlementPrice}
              onChange={(event) => setSettlementPrice(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") handleCalculate();
              }}
            />
          </div>
          <div className="bg-kumo-base p-5">
            <Input
              label="Option size Q (sats)"
              placeholder="e.g. 14200"
              value={qSats}
              onChange={(event) => setQSats(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") handleCalculate();
              }}
            />
          </div>
          <div className="bg-kumo-base p-5">
            <Input
              label="Premium bps"
              placeholder="e.g. 100"
              value={premiumBps}
              onChange={(event) => setPremiumBps(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") handleCalculate();
              }}
            />
          </div>
          <div className="bg-kumo-base p-5" />
        </div>
      </LayerCard>

      <LayerCard className="rounded-none border vol-hairline p-0">
        <div className="grid grid-cols-1 gap-px bg-[color:var(--vol-hairline)] md:grid-cols-3">
          <div className="bg-kumo-base p-5">
            <Input
              label="Premium fee bps (default: 500 = 5%)"
              placeholder="e.g. 500"
              value={premiumFeeBps}
              onChange={(event) => setPremiumFeeBps(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") handleCalculate();
              }}
            />
          </div>
          <div className="bg-kumo-base p-5">
            <Input
              label="Profit fee bps (default: 2000 = 20%)"
              placeholder="e.g. 2000"
              value={profitFeeBps}
              onChange={(event) => setProfitFeeBps(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") handleCalculate();
              }}
            />
          </div>
          <div className="bg-kumo-base p-5">
            <Input
              label="ckBTC transfer fee (sats)"
              placeholder="e.g. 10"
              value={transferFeeSats}
              onChange={(event) => setTransferFeeSats(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") handleCalculate();
              }}
            />
          </div>
        </div>
      </LayerCard>

      {hasResults ? (
        <CalcResults results={results} />
      ) : (
        <Empty
          size="sm"
          icon={<Calculator size={36} className="text-kumo-inactive" />}
          title="No calculation yet"
          description="Fill in the fields above and click Calculate to see the option math broken down step by step."
        />
      )}
    </PageShell>
  );
}

function CalcResults({ results }: { results: OptionsCalcResults }) {
  return (
    <>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <MetricCard
          label="Uplift"
          value={formatDollarsFromCents(results.upliftPriceCents)}
          mono
          tone="default"
        />
        <MetricCard
          label="Strike price"
          value={formatDollarsFromCents(results.strikePriceCents)}
          mono
          tone={results.isInTheMoney ? "ok" : "default"}
        />
        <MetricCard
          label="Gross premium"
          value={formatSatsDisplay(results.grossPremiumSats)}
          mono
          tone="default"
        />
        <MetricCard
          label="Premium fee"
          value={formatSatsDisplay(results.premiumFeeSats)}
          mono
          tone="default"
        />
        <MetricCard
          label="Writer net premium"
          value={formatSatsDisplay(results.writerPremiumSats)}
          mono
          tone="default"
        />
        <MetricCard
          label="Status"
          value={results.isInTheMoney ? "ITM" : "OTM"}
          mono
          tone={results.isInTheMoney ? "ok" : "warn"}
        />
        <MetricCard
          label="Profit (USD)"
          value={formatDollarsFromCents(results.profitCents)}
          mono
          tone={results.isInTheMoney ? "ok" : "default"}
        />
        <MetricCard
          label="Gross buyer payout"
          value={formatSatsDisplay(results.grossBuyerPayoutSats)}
          mono
          tone={results.isInTheMoney ? "ok" : "default"}
        />
        <MetricCard
          label="Profit fee"
          value={formatSatsDisplay(results.profitFeeSats)}
          mono
          tone="default"
        />
        <MetricCard
          label="Buyer net"
          value={formatSatsDisplay(results.buyerNetSats)}
          mono
          tone={results.isInTheMoney ? "ok" : "default"}
        />
        <MetricCard
          label="Writer collateral remainder"
          value={formatSatsDisplay(results.writerCollateralRemainderSats)}
          mono
          tone="default"
        />
        <MetricCard
          label="Writer returned"
          value={formatSatsDisplay(results.writerReturnedSats)}
          mono
          tone="default"
        />
      </div>

      <CalcSteps results={results} />
    </>
  );
}

function CalcSteps({ results }: { results: OptionsCalcResults }) {
  const { grossPremiumSats, grossBuyerPayoutSats } = results;

  const settlementTransferFeeTotal = grossBuyerPayoutSats > 0n
    ? DEFAULT_CKBTC_TRANSFER_FEE_SATS * 2n
    : 0n;

  return (
    <LayerCard className="rounded-none border vol-hairline p-5">
      <div className="space-y-3 font-mono text-sm text-kumo-default">
        <StepLine label="A. Strike" value={`Entry + Entry × Strike bps ÷ ${BPS_DENOMINATOR} = Strike`} />
        <StepLine
          label="B. Gross premium (sats)"
          value={`Q × Premium bps ÷ ${BPS_DENOMINATOR} = ${grossPremiumSats.toLocaleString()} sats`}
        />
        <StepLine label="C. Premium fee (sats)" value="Gross premium × Premium fee bps ÷ 10,000" />
        <StepLine label="D. Writer net premium" value="Gross premium − Premium fee" />
        <StepLine
          label="E. In the money?"
          value={results.isInTheMoney ? "Yes (Settlement > Strike)" : "No (Settlement ≤ Strike)"}
        />
        {results.isInTheMoney && (
          <StepLine
            label="F. Gross buyer payout (sats)"
            value={`Q × (Settlement − Strike) ÷ Settlement = ${grossBuyerPayoutSats.toLocaleString()} sats`}
          />
        )}
        {grossBuyerPayoutSats > 0n && (
          <StepLine label="G. Profit fee (sats)" value="Gross buyer payout × Profit fee bps ÷ 10,000" />
        )}
        <StepLine label="H. Writer from collateral" value="Q − Gross buyer payout = writer remainder" />
        <StepLine
          label="  Settlement transfer fees"
          value={grossBuyerPayoutSats > 0n
            ? `2 × ckBTC transfer fee = ${settlementTransferFeeTotal.toLocaleString()} sats`
            : "No payout → no transfer"}
        />
        <StepLine
          label="  Writer returned (net)"
          value="Writer remainder − settlement transfer fees"
        />
      </div>
    </LayerCard>
  );
}

function StepLine({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-kumo-subtle">{label}</span>
      <br />
      <span>{value}</span>
    </div>
  );
}
