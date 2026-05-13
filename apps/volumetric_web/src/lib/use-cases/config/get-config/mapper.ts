import { z } from "zod";
import type { ConfigData, FeeConfig } from "@/types/config";

const RangeU64Schema = z.object({ min: z.bigint(), max: z.bigint() });
const RangeU16Schema = z.object({
  min: z.number().or(z.bigint()),
  max: z.number().or(z.bigint()),
});

const TradingLimitsSchema = z.object({
  create_offer_quantity_sats: RangeU64Schema,
  accept_offer_quantity_sats: RangeU64Schema,
  premium_basis_points: RangeU16Schema,
  strike_basis_points: RangeU16Schema,
  option_duration_seconds: RangeU64Schema,
  deposit_amount_sats: z.bigint(),
  withdraw_amount_sats: z.bigint(),
});

const FeeConfigSchema = z.object({
  premium_fee_basis_points: z.bigint(),
  profit_fee_basis_points: z.bigint(),
  fee_recipient: z.custom<{ toText: () => string }>(),
});

const BASIS_POINTS_PER_PERCENT = 100;
const DEFAULT_TERM_OPTIONS = [3, 7];
const STRIKE_PERCENT_OPTIONS = [2, 3, 5, 8];
const PREMIUM_STEP = 0.1;
const SECONDS_PER_DAY = 86_400;

function mapFeeConfig(rawFeeConfig: unknown): FeeConfig {
  const feeConfig = FeeConfigSchema.parse(rawFeeConfig);
  return {
    premiumFeeBasisPoints: feeConfig.premium_fee_basis_points,
    profitFeeBasisPoints: feeConfig.profit_fee_basis_points,
    feeRecipient: feeConfig.fee_recipient.toText(),
  };
}

export function mapConfig(rawLimits: unknown, rawFeeConfig: unknown): ConfigData {
  const limits = TradingLimitsSchema.parse(rawLimits);

  const minDurationSecondsBn = limits.option_duration_seconds.min;
  const maxDurationSecondsBn = limits.option_duration_seconds.max;
  const secondsPerDayBn = BigInt(SECONDS_PER_DAY);

  const termOptions = DEFAULT_TERM_OPTIONS.filter((days) => {
    const durationSeconds = BigInt(days) * secondsPerDayBn;
    return durationSeconds >= minDurationSecondsBn && durationSeconds <= maxDurationSecondsBn;
  });

  const minTermDays = termOptions[0] ?? 0;
  const maxTermDays = termOptions[termOptions.length - 1] ?? 0;

  return {
    canisterId: process.env.CANISTER_ID,
    icHost: process.env.IC_HOST || "https://ic0.app",
    termOptions,
    strikePercentOptions: STRIKE_PERCENT_OPTIONS,
    premium: {
      min: Number(limits.premium_basis_points.min) / BASIS_POINTS_PER_PERCENT,
      max: Number(limits.premium_basis_points.max) / BASIS_POINTS_PER_PERCENT,
      step: PREMIUM_STEP,
    },
    minCreateOfferAmountSats: Number(limits.create_offer_quantity_sats.min),
    maxCreateOfferAmountSats: Number(limits.create_offer_quantity_sats.max),
    minAcceptOfferAmountSats: Number(limits.accept_offer_quantity_sats.min),
    maxAcceptOfferAmountSats: Number(limits.accept_offer_quantity_sats.max),
    minDepositAmountSats: Number(limits.deposit_amount_sats),
    minWithdrawAmountSats: Number(limits.withdraw_amount_sats),
    minTermDays,
    maxTermDays,
    fees: mapFeeConfig(rawFeeConfig),
  };
}
