import { getCanisterActor } from "@/lib/canister-server";
import { handleCanisterError, publicProcedure, router } from "../trpc";

const BASIS_POINTS_PER_PERCENT = 100;

export const configRouter = router({
  get: publicProcedure.query(async () => {
    try {
      const actor = await getCanisterActor();
      const limits = await actor.get_trading_limits();

      const minTermDays = Number(limits.term_days.min);
      const maxTermDays = Number(limits.term_days.max);

      const defaultTermOptions = [1, 7, 14];
      let termOptions = defaultTermOptions.filter(
        (days) => days >= minTermDays && days <= maxTermDays,
      );

      if (termOptions.length === 0) {
        termOptions = [Math.max(minTermDays, 1)];
      }

      return {
        termOptions,
        strikePercentOptions: [5, 10, 15, 20],
        premium: {
          min: Number(limits.premium_basis_points.min) / BASIS_POINTS_PER_PERCENT,
          max: Number(limits.premium_basis_points.max) / BASIS_POINTS_PER_PERCENT,
          step: 0.25,
        },
        minOfferAmountSats: limits.quantity_sats.min,
        maxOfferAmountSats: limits.quantity_sats.max,
        minDepositAmountSats: limits.deposit_amount_sats,
        minWithdrawAmountSats: limits.withdraw_amount_sats,
        minTermDays,
        maxTermDays,
        minOptionDurationSeconds: limits.option_duration_seconds.min,
        maxOptionDurationSeconds: limits.option_duration_seconds.max,
      };
    } catch (error) {
      handleCanisterError(error);
    }
  }),

  getCanisterInfo: publicProcedure.query(async () => {
    return {
      canisterId: process.env.CANISTER_ID,
      icHost: process.env.IC_HOST || "https://ic0.app",
    };
  }),
});
