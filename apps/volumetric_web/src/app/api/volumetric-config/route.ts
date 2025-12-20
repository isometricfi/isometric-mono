import "server-only";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getCanisterActor } from "@/lib/canister-server";
import type { ConfigData } from "@/types/config";

const RangeU64Schema = z.object({ min: z.bigint(), max: z.bigint() });
const RangeU16Schema = z.object({ min: z.number().or(z.bigint()), max: z.number().or(z.bigint()) });

const BASIS_POINTS_PER_PERCENT = 100;

const TradingLimitsSchema = z.object({
  term_days: RangeU64Schema,
  quantity_sats: RangeU64Schema,
  premium_basis_points: RangeU16Schema,
  strike_basis_points: RangeU16Schema,
  option_duration_seconds: RangeU64Schema,
  deposit_amount_sats: z.bigint(),
  withdraw_amount_sats: z.bigint(),
});

export async function GET() {
  const actor = await getCanisterActor();
  const rawLimits = await actor.get_trading_limits();

  // Validate canister response
  const limits = TradingLimitsSchema.parse(rawLimits);

  const minTermDays = Number(limits.term_days.min);
  const maxTermDays = Number(limits.term_days.max);

  if (minTermDays > maxTermDays) {
    throw new Error(`Invalid term limits: min (${minTermDays}) > max (${maxTermDays})`);
  }

  // Default UI options, filtered by actual canister limits
  const defaultTermOptions = [1, 7, 14];
  const termOptions = defaultTermOptions.filter(
    (days) => days >= minTermDays && days <= maxTermDays,
  );

  // Fallback if strict limits filter out all options
  if (termOptions.length === 0) {
    termOptions.push(Math.max(minTermDays, 1));
  }

  const config: ConfigData = {
    termOptions,
    strikePercentOptions: [5, 10, 15, 20],
    premium: {
      min: Number(limits.premium_basis_points.min) / BASIS_POINTS_PER_PERCENT,
      max: Number(limits.premium_basis_points.max) / BASIS_POINTS_PER_PERCENT,
      step: 0.25,
    },
    minOfferAmountSats: Number(limits.quantity_sats.min),
    maxOfferAmountSats: Number(limits.quantity_sats.max),
    minDepositAmountSats: Number(limits.deposit_amount_sats),
    minWithdrawAmountSats: Number(limits.withdraw_amount_sats),
    minTermDays,
    maxTermDays,
  };

  return NextResponse.json(config);
}
