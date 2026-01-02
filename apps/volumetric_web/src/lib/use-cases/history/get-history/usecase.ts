import type { HistoryEntry, MoneyStatus, Output, TradeResult } from "./schema";

const NS_PER_MS = BigInt(1_000_000);
const SATS_PER_BTC = BigInt(100_000_000);
const ZERO = BigInt(0);

function generateMockEntry(index: number): HistoryEntry {
  const roles = ["buyer", "writer"] as const;
  const role = roles[index % 2];

  const baseDate = Date.now() - index * 24 * 60 * 60 * 1000 * (1 + Math.random() * 2);
  const acceptedAt = BigInt(Math.floor(baseDate)) * NS_PER_MS;
  const settledAt =
    BigInt(Math.floor(baseDate + 7 * 24 * 60 * 60 * 1000 * (1 + Math.random()))) * NS_PER_MS;

  const entryPrice = 90000 + Math.random() * 20000;
  const entryPriceCents = BigInt(Math.floor(entryPrice * 100));

  const strikeMultiplier = 1 + (Math.random() * 0.2 - 0.05);
  const strikePrice = entryPrice * strikeMultiplier;
  const strikePriceCents = BigInt(Math.floor(strikePrice * 100));

  const settlementMultiplier = 0.9 + Math.random() * 0.3;
  const settlementPrice = entryPrice * settlementMultiplier;
  const settlementPriceCents = BigInt(Math.floor(settlementPrice * 100));

  const quantityBtc = 0.01 + Math.random() * 0.09;
  const quantitySats = BigInt(Math.floor(quantityBtc * Number(SATS_PER_BTC)));

  const premiumPercent = 0.02 + Math.random() * 0.03;
  const premiumSats = BigInt(Math.floor(quantityBtc * premiumPercent * Number(SATS_PER_BTC)));

  const isItm = settlementPrice > strikePrice;
  let payoutSats: bigint;
  let pnlSats: bigint;

  if (isItm) {
    const gainPercent = (settlementPrice - strikePrice) / strikePrice;
    const buyerGainSats = BigInt(Math.floor(quantityBtc * gainPercent * Number(SATS_PER_BTC)));
    const cappedGain = buyerGainSats > quantitySats ? quantitySats : buyerGainSats;

    if (role === "buyer") {
      payoutSats = cappedGain;
      pnlSats = cappedGain - premiumSats;
    } else {
      payoutSats = quantitySats + premiumSats - cappedGain;
      pnlSats = premiumSats - cappedGain;
    }
  } else {
    if (role === "buyer") {
      payoutSats = ZERO;
      pnlSats = -premiumSats;
    } else {
      payoutSats = quantitySats + premiumSats;
      pnlSats = premiumSats;
    }
  }

  const premiumNum = Number(premiumSats);
  const pnlNum = Number(pnlSats);
  const quantityNum = Number(quantitySats);

  let pnlPercent: number;
  if (role === "buyer") {
    pnlPercent = premiumNum > 0 ? (pnlNum / premiumNum) * 100 : 0;
  } else {
    pnlPercent = quantityNum > 0 ? (pnlNum / quantityNum) * 100 : 0;
  }

  let result: TradeResult;
  if (pnlSats > ZERO) {
    result = "profit";
  } else if (pnlSats < ZERO) {
    result = "loss";
  } else {
    result = "breakeven";
  }

  let moneyStatus: MoneyStatus;
  const strikePriceNum = Number(strikePriceCents) / 100;
  const settlementPriceNum = Number(settlementPriceCents) / 100;
  const threshold = strikePriceNum * 0.01;

  if (Math.abs(settlementPriceNum - strikePriceNum) < threshold) {
    moneyStatus = "atm";
  } else if (settlementPriceNum > strikePriceNum) {
    moneyStatus = "itm";
  } else {
    moneyStatus = "otm";
  }

  return {
    id: `hist-${index + 1}`,
    role,
    optionType: "call",
    quantitySats,
    strikePriceCents,
    entryPriceCents,
    settlementPriceCents,
    premiumSats,
    payoutSats,
    pnlSats,
    pnlPercent,
    result,
    moneyStatus,
    acceptedAt,
    settledAt,
  };
}

export async function getHistory(_address: string): Promise<Output> {
  const entryCount = 35;
  const entries: HistoryEntry[] = [];

  for (let i = 0; i < entryCount; i++) {
    entries.push(generateMockEntry(i));
  }

  entries.sort((a, b) => Number(b.settledAt - a.settledAt));

  return { entries };
}
