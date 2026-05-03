export const DEFAULT_PREMIUM_FEE_BPS = 500n;
export const DEFAULT_PROFIT_FEE_BPS = 2000n;
export const BPS_DENOMINATOR = 10_000n;
export const DEFAULT_CKBTC_TRANSFER_FEE_SATS = 10n;
export const CENTS_PER_DOLLAR = 100n;

export interface OptionsCalcInputs {
  entryPriceCents: bigint;
  strikeBps: bigint;
  optionSizeSats: bigint;
  premiumBps: bigint;
  settlementPriceCents: bigint;
  premiumFeeBps: bigint;
  profitFeeBps: bigint;
  ckbtcTransferFeeSats: bigint;
}

export interface OptionsCalcResults {
  upliftPriceCents: bigint;
  strikePriceCents: bigint;
  grossPremiumSats: bigint;
  premiumFeeSats: bigint;
  writerPremiumSats: bigint;
  isInTheMoney: boolean;
  profitCents: bigint;
  grossBuyerPayoutSats: bigint;
  profitFeeSats: bigint;
  buyerNetSats: bigint;
  writerCollateralRemainderSats: bigint;
  writerReturnedSats: bigint;
}

export function calculateOptions(inputs: OptionsCalcInputs): OptionsCalcResults {
  const {
    entryPriceCents,
    strikeBps,
    optionSizeSats,
    premiumBps,
    settlementPriceCents,
    premiumFeeBps,
    profitFeeBps,
    ckbtcTransferFeeSats,
  } = inputs;

  const upliftPriceCents = (entryPriceCents * strikeBps) / BPS_DENOMINATOR;
  const strikePriceCents = entryPriceCents + upliftPriceCents;

  const grossPremiumSats = (optionSizeSats * premiumBps) / BPS_DENOMINATOR;
  const premiumFeeSats = (grossPremiumSats * premiumFeeBps) / BPS_DENOMINATOR;
  const writerPremiumSats = grossPremiumSats - premiumFeeSats;

  const isInTheMoney = settlementPriceCents > strikePriceCents;

  let profitCents: bigint;
  let grossBuyerPayoutSats: bigint;

  if (isInTheMoney) {
    profitCents = settlementPriceCents - strikePriceCents;
    grossBuyerPayoutSats = (optionSizeSats * profitCents) / settlementPriceCents;
  } else {
    profitCents = 0n;
    grossBuyerPayoutSats = 0n;
  }

  const profitFeeSats = (grossBuyerPayoutSats * profitFeeBps) / BPS_DENOMINATOR;
  const buyerNetSats = grossBuyerPayoutSats - profitFeeSats;

  const writerCollateralRemainderSats = optionSizeSats - grossBuyerPayoutSats;

  const settlementTransferFeeSats = grossBuyerPayoutSats > 0n
    ? ckbtcTransferFeeSats * 2n
    : 0n;

  const writerReturnedSats = writerCollateralRemainderSats - settlementTransferFeeSats;

  return {
    upliftPriceCents,
    strikePriceCents,
    grossPremiumSats,
    premiumFeeSats,
    writerPremiumSats,
    isInTheMoney,
    profitCents,
    grossBuyerPayoutSats,
    profitFeeSats,
    buyerNetSats,
    writerCollateralRemainderSats,
    writerReturnedSats,
  };
}

export function dollarsToCents(dollars: string): bigint {
  const parsed = Number.parseFloat(dollars);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error("Enter a valid non-negative dollar amount.");
  }
  return BigInt(Math.round(parsed * 100));
}

export function formatDollarsFromCents(cents: bigint): string {
  const dollars = Number(cents) / 100;
  return `$${dollars.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatSatsDisplay(sats: bigint): string {
  return `${sats.toLocaleString("en-US")} sats`;
}

export function formatBpsDisplay(bps: bigint): string {
  const percent = Number(bps) / 100;
  return `${percent.toLocaleString("en-US", {
    maximumFractionDigits: 2,
  })}%`;
}
