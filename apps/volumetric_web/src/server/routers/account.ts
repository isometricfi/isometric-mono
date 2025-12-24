import { unwrapResult } from "@volumetric/canister-types";
import { z } from "zod";
import { getCanisterActor } from "@/lib/canister-server";
import { handleCanisterError, publicProcedure, router } from "../trpc";

export const accountRouter = router({
  get: publicProcedure.input(z.object({ address: z.string().min(1) })).query(async ({ input }) => {
    try {
      const actor = await getCanisterActor();

      const [profileResult, balanceResult] = await Promise.all([
        actor.get_account_info(input.address),
        actor.get_user_balance(input.address),
      ]);

      const profile = profileResult.length > 0 ? profileResult[0] : null;
      const balance = "Ok" in balanceResult ? balanceResult.Ok : null;

      return { profile, balance };
    } catch (error) {
      handleCanisterError(error);
    }
  }),

  create: publicProcedure
    .input(
      z.object({
        address: z.string().min(1),
        signature: z.string().min(1),
      }),
    )
    .mutation(async ({ input }) => {
      try {
        const actor = await getCanisterActor();
        const result = await actor.create_account({
          data: {},
          wallet_proof: { address: input.address, signature: input.signature },
        });

        return unwrapResult(result);
      } catch (error) {
        handleCanisterError(error);
      }
    }),

  getBalance: publicProcedure
    .input(z.object({ address: z.string().min(1) }))
    .query(async ({ input }) => {
      try {
        const actor = await getCanisterActor();
        const result = await actor.get_ckbtc_balance(input.address);
        return unwrapResult(result);
      } catch (error) {
        handleCanisterError(error);
      }
    }),

  getDepositAddress: publicProcedure
    .input(z.object({ address: z.string().min(1) }))
    .query(async ({ input }) => {
      try {
        const actor = await getCanisterActor();
        const result = await actor.get_deposit_address(input.address);
        return unwrapResult(result);
      } catch (error) {
        handleCanisterError(error);
      }
    }),

  withdraw: publicProcedure
    .input(
      z.object({
        address: z.string().min(1),
        signature: z.string().min(1),
        btcAddress: z.string().min(1),
        amount: z.bigint(),
      }),
    )
    .mutation(async ({ input }) => {
      try {
        const actor = await getCanisterActor();
        const result = await actor.withdraw_ckbtc({
          data: {
            btc_address: input.btcAddress,
            amount: input.amount,
          },
          wallet_proof: { address: input.address, signature: input.signature },
        });

        return unwrapResult(result);
      } catch (error) {
        handleCanisterError(error);
      }
    }),

  updateUsername: publicProcedure
    .input(
      z.object({
        address: z.string().min(1),
        signature: z.string().min(1),
        username: z.string().min(1),
      }),
    )
    .mutation(async ({ input }) => {
      try {
        const actor = await getCanisterActor();
        const result = await actor.update_username({
          data: { username: input.username },
          wallet_proof: { address: input.address, signature: input.signature },
        });

        return unwrapResult(result);
      } catch (error) {
        handleCanisterError(error);
      }
    }),

  syncBalance: publicProcedure
    .input(z.object({ address: z.string().min(1) }))
    .mutation(async ({ input }) => {
      try {
        const actor = await getCanisterActor();
        const result = await actor.update_ckbtc_balance(input.address);
        unwrapResult(result);
        return { success: true };
      } catch (error) {
        handleCanisterError(error);
      }
    }),
});
