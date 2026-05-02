import type { ActiveOption } from "@volumetric/canister-types";

export const BASIS_POINTS_DENOMINATOR = 10_000n;

export type OptionPrediction = {
  optionId: bigint;
  buyer: string;
  writer: string;
  quantitySats: bigint;
  entryPriceCents: bigint;
  strikePriceCents: bigint;
  settlementPriceCents: bigint;
  isInTheMoney: boolean;
  grossBuyerPayoutSats: bigint;
  profitFeeSats: bigint;
  netBuyerPayoutSats: bigint;
  grossWriterPayoutSats: bigint;
  transferFeeTotalSats: bigint;
  netWriterPayoutSats: bigint;
};

export type PredictionSummary = {
  predictedSettlementPriceCents: bigint;
  totalGrossBuyerPayoutSats: bigint;
  totalProfitFeeSats: bigint;
  totalNetBuyerPayoutSats: bigint;
  totalGrossWriterPayoutSats: bigint;
  totalTransferFeeTotalSats: bigint;
  totalNetWriterPayoutSats: bigint;
  optionCount: number;
  itmCount: number;
};

export function calculateOptionPrediction({
  option,
  settlementPriceCents,
  profitFeeBasisPoints,
  icrc1TransferFeeSats,
}: {
  option: ActiveOption;
  settlementPriceCents: bigint;
  profitFeeBasisPoints: bigint;
  icrc1TransferFeeSats: bigint;
}): OptionPrediction {
  const isInTheMoney = settlementPriceCents > option.strike_price_cents;

  let grossBuyerPayoutSats: bigint;
  let profitFeeSats: bigint;

  if (isInTheMoney) {
    const profitCents = settlementPriceCents - option.strike_price_cents;
    grossBuyerPayoutSats = (option.quantity * profitCents) / settlementPriceCents;
    profitFeeSats = (grossBuyerPayoutSats * profitFeeBasisPoints) / BASIS_POINTS_DENOMINATOR;
  } else {
    grossBuyerPayoutSats = 0n;
    profitFeeSats = 0n;
  }

  const netBuyerPayoutSats = grossBuyerPayoutSats - profitFeeSats;
  const grossWriterPayoutSats = option.quantity - grossBuyerPayoutSats;

  let transferCount = 0n;
  if (netBuyerPayoutSats > 0n) transferCount += 1n;
  if (profitFeeSats > 0n) transferCount += 1n;
  const transferFeeTotalSats = transferCount * icrc1TransferFeeSats;

  const netWriterPayoutSats = grossWriterPayoutSats - transferFeeTotalSats;

  return {
    optionId: option.id,
    buyer: option.buyer.toText(),
    writer: option.writer.toText(),
    quantitySats: option.quantity,
    entryPriceCents: option.entry_price_cents,
    strikePriceCents: option.strike_price_cents,
    settlementPriceCents,
    isInTheMoney,
    grossBuyerPayoutSats,
    profitFeeSats,
    netBuyerPayoutSats,
    grossWriterPayoutSats,
    transferFeeTotalSats,
    netWriterPayoutSats,
  };
}

export function predictPayouts({
  options,
  settlementPriceCents,
  profitFeeBasisPoints,
  icrc1TransferFeeSats,
}: {
  options: ActiveOption[];
  settlementPriceCents: bigint;
  profitFeeBasisPoints: bigint;
  icrc1TransferFeeSats: bigint;
}): { predictions: OptionPrediction[]; summary: PredictionSummary } {
  const predictions = options.map((option) =>
    calculateOptionPrediction({
      option,
      settlementPriceCents,
      profitFeeBasisPoints,
      icrc1TransferFeeSats,
    }),
  );

  const summary: PredictionSummary = {
    predictedSettlementPriceCents: settlementPriceCents,
    totalGrossBuyerPayoutSats: 0n,
    totalProfitFeeSats: 0n,
    totalNetBuyerPayoutSats: 0n,
    totalGrossWriterPayoutSats: 0n,
    totalTransferFeeTotalSats: 0n,
    totalNetWriterPayoutSats: 0n,
    optionCount: predictions.length,
    itmCount: 0,
  };

  for (const prediction of predictions) {
    summary.totalGrossBuyerPayoutSats += prediction.grossBuyerPayoutSats;
    summary.totalProfitFeeSats += prediction.profitFeeSats;
    summary.totalNetBuyerPayoutSats += prediction.netBuyerPayoutSats;
    summary.totalGrossWriterPayoutSats += prediction.grossWriterPayoutSats;
    summary.totalTransferFeeTotalSats += prediction.transferFeeTotalSats;
    summary.totalNetWriterPayoutSats += prediction.netWriterPayoutSats;
    if (prediction.isInTheMoney) {
      summary.itmCount += 1;
    }
  }

  return { predictions, summary };
}
