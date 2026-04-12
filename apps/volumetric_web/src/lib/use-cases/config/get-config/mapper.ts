import { z } from "zod";
import type { ConfigData, FeeConfig } from "@/types/config";

const RangeU64Schema = z.object({ min: z.bigint(), max: z.bigint() });
const RangeU16Schema = z.object({ min: z.number().or(z.bigint()), max: z.number().or(z.bigint()) });

const TradingLimitsSchema = z.object({
  term_days: RangeU64Schema,
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
const DEFAULT_TERM_OPTIONS = [1, 7, 14];
const STRIKE_PERCENT_OPTIONS = [5, 10, 15, 20];
const PREMIUM_STEP = 0.25;

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

  const minTermDays = Number(limits.term_days.min);
  const maxTermDays = Number(limits.term_days.max);

  if (minTermDays > maxTermDays) {
    throw new Error(`Invalid term limits: min (${minTermDays}) > max (${maxTermDays})`);
  }

  const termOptions = DEFAULT_TERM_OPTIONS.filter(
    (days) => days >= minTermDays && days <= maxTermDays,
  );

  if (termOptions.length === 0) {
    termOptions.push(Math.max(minTermDays, 1));
  }

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
