import type { _SERVICE } from "@volumetric/canister-types";
import { getCreateAccountMessage } from "../canister-client.js";
import { botLog, withBotSpan } from "../telemetry.js";
import type { TRPCClient } from "../trpc-client.js";
import type { BotWallet } from "../wallet.js";

export async function setup(actor: _SERVICE, trpc: TRPCClient, wallet: BotWallet): Promise<void> {
  await withBotSpan("bot.setup", { address: wallet.address }, async (span) => {
    botLog("info", "Checking if account exists", { address: wallet.address });

    const existingAccount = await trpc.account.getAccount.query({
      address: wallet.address,
    });

    if (existingAccount) {
      const depositInfo = await trpc.account.getDepositAddress.query({
        address: wallet.address,
      });

      botLog("info", "Account already registered", {
        address: wallet.address,
        deposit_address: depositInfo.btcAddress,
      });
      span.setAttribute("account.existed", true);
      return;
    }

    botLog("info", "Creating new account", { address: wallet.address });

    const message = await getCreateAccountMessage(actor, wallet.address);
    const signature = wallet.signMessage(message);

    const result = await trpc.account.createAccount.mutate({
      address: wallet.address,
      signature,
    });

    const depositInfo = await trpc.account.getDepositAddress.query({
      address: wallet.address,
    });

    botLog("info", "Account created successfully", {
      address: wallet.address,
      principal: result.principal,
      deposit_address: depositInfo.btcAddress,
    });
    span.setAttribute("account.existed", false);
    span.setAttribute("account.principal", result.principal);
  });
}
