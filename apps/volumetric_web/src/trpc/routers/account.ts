import { inputSchema as createAccountSchema } from "@/lib/use-cases/account/create-account/schema";
import { createAccount } from "@/lib/use-cases/account/create-account/usecase";
import { inputSchema as getAccountSchema } from "@/lib/use-cases/account/get-account/schema";
import { getAccount } from "@/lib/use-cases/account/get-account/usecase";
import { inputSchema as getBalanceSchema } from "@/lib/use-cases/account/get-balance/schema";
import { getBalance } from "@/lib/use-cases/account/get-balance/usecase";
import { inputSchema as getDepositAddressSchema } from "@/lib/use-cases/account/get-deposit-address/schema";
import { getDepositAddress } from "@/lib/use-cases/account/get-deposit-address/usecase";
import { inputSchema as getPendingDepositsSchema } from "@/lib/use-cases/account/get-pending-deposits/schema";
import { getPendingDeposits } from "@/lib/use-cases/account/get-pending-deposits/usecase";
import { inputSchema as getPendingWithdrawalsSchema } from "@/lib/use-cases/account/get-pending-withdrawals/schema";
import { getPendingWithdrawals } from "@/lib/use-cases/account/get-pending-withdrawals/usecase";
import { inputSchema as syncBalanceSchema } from "@/lib/use-cases/account/sync-balance/schema";
import { syncBalance } from "@/lib/use-cases/account/sync-balance/usecase";
import { inputSchema as updateUsernameSchema } from "@/lib/use-cases/account/update-username/schema";
import { updateUsername } from "@/lib/use-cases/account/update-username/usecase";
import { inputSchema as withdrawSchema } from "@/lib/use-cases/account/withdraw/schema";
import { withdraw } from "@/lib/use-cases/account/withdraw/usecase";
import { publicProcedure, router } from "../init";

export const accountRouter = router({
  getAccount: publicProcedure
    .input(getAccountSchema)
    .query(({ input }) => getAccount(input.address)),

  createAccount: publicProcedure
    .input(createAccountSchema)
    .mutation(({ input }) => createAccount(input)),

  getDepositAddress: publicProcedure
    .input(getDepositAddressSchema)
    .query(({ input }) => getDepositAddress(input.address)),

  getBalance: publicProcedure
    .input(getBalanceSchema)
    .query(({ input }) => getBalance(input.address)),

  getPendingDeposits: publicProcedure
    .input(getPendingDepositsSchema)
    .query(({ input }) => getPendingDeposits(input.address)),

  getPendingWithdrawals: publicProcedure
    .input(getPendingWithdrawalsSchema)
    .query(({ input }) => getPendingWithdrawals(input.address)),

  updateUsername: publicProcedure
    .input(updateUsernameSchema)
    .mutation(({ input }) => updateUsername(input)),

  withdraw: publicProcedure.input(withdrawSchema).mutation(({ input }) => withdraw(input)),

  syncBalance: publicProcedure
    .input(syncBalanceSchema)
    .mutation(({ input }) => syncBalance(input.address)),
});
