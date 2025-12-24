import { unwrapResult } from "@volumetric/canister-types";
import { z } from "zod";
import { getCanisterActor } from "@/lib/canister-server";
import { handleCanisterError, publicProcedure, router } from "../trpc";

export const optionsRouter = router({
  list: publicProcedure.query(async () => {
    try {
      const actor = await getCanisterActor();
      return actor.get_open_offers();
    } catch (error) {
      handleCanisterError(error);
    }
  }),

  create: publicProcedure
    .input(
      z.object({
        address: z.string().min(1),
        signature: z.string().min(1),
        quantity: z.bigint(),
        strikeBasisPoints: z.number(),
        premiumBasisPoints: z.number(),
        offerValidUntil: z.bigint(),
        optionDurationSeconds: z.bigint(),
      }),
    )
    .mutation(async ({ input }) => {
      try {
        const actor = await getCanisterActor();
        const result = await actor.create_offer({
          wallet_proof: { address: input.address, signature: input.signature },
          data: {
            asset: { CkBtc: null },
            option_type: { Call: null },
            quantity: input.quantity,
            strike_basis_points: input.strikeBasisPoints,
            premium_basis_points: input.premiumBasisPoints,
            offer_valid_until: input.offerValidUntil,
            option_duration_seconds: input.optionDurationSeconds,
          },
        });

        return unwrapResult(result);
      } catch (error) {
        handleCanisterError(error);
      }
    }),

  accept: publicProcedure
    .input(
      z.object({
        address: z.string().min(1),
        signature: z.string().min(1),
        items: z
          .array(
            z.object({
              offerId: z.bigint(),
              quantity: z.bigint(),
            }),
          )
          .min(1),
      }),
    )
    .mutation(async ({ input }) => {
      try {
        const actor = await getCanisterActor();
        const result = await actor.accept_offers({
          wallet_proof: { address: input.address, signature: input.signature },
          data: {
            items: input.items.map((item) => ({
              offer_id: item.offerId,
              quantity: item.quantity,
            })),
          },
        });

        return unwrapResult(result);
      } catch (error) {
        handleCanisterError(error);
      }
    }),

  cancel: publicProcedure
    .input(
      z.object({
        address: z.string().min(1),
        signature: z.string().min(1),
        offerId: z.bigint(),
      }),
    )
    .mutation(async ({ input }) => {
      try {
        const actor = await getCanisterActor();
        const result = await actor.cancel_offer({
          wallet_proof: { address: input.address, signature: input.signature },
          data: { offer_id: input.offerId },
        });

        return unwrapResult(result);
      } catch (error) {
        handleCanisterError(error);
      }
    }),

  settle: publicProcedure.input(z.object({ optionId: z.bigint() })).mutation(async ({ input }) => {
    try {
      const actor = await getCanisterActor();
      const result = await actor.settle_option_by_id(input.optionId);
      return unwrapResult(result);
    } catch (error) {
      handleCanisterError(error);
    }
  }),

  testingExpire: publicProcedure
    .input(z.object({ optionId: z.bigint() }))
    .mutation(async ({ input }) => {
      try {
        const actor = await getCanisterActor();
        const result = await actor.testing_expire_option(input.optionId);
        return unwrapResult(result);
      } catch (error) {
        handleCanisterError(error);
      }
    }),

  testingForceSettle: publicProcedure
    .input(z.object({ optionId: z.bigint() }))
    .mutation(async ({ input }) => {
      try {
        const actor = await getCanisterActor();
        const result = await actor.testing_force_settle(input.optionId);
        return unwrapResult(result);
      } catch (error) {
        handleCanisterError(error);
      }
    }),

  testingSetOraclePrice: publicProcedure
    .input(z.object({ priceCents: z.bigint() }))
    .mutation(async ({ input }) => {
      try {
        const actor = await getCanisterActor();
        const result = await actor.set_oracle_price(input.priceCents);
        unwrapResult(result);
        return { success: true };
      } catch (error) {
        handleCanisterError(error);
      }
    }),
});
