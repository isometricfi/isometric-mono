import type { _SERVICE } from "@volumetric/canister-types";
import { getCreateAccountMessage } from "../canister-client.js";
import { log, withSpan } from "../telemetry.js";
import type { TRPCClient } from "../trpc-client.js";
import type { BotWallet } from "../wallet.js";

export async function setup(actor: _SERVICE, trpc: TRPCClient, wallet: BotWallet): Promise<void> {
  await withSpan("bot.setup", { address: wallet.address }, async (span) => {
    log("info", "Checking if account exists", { address: wallet.address });

    const existingAccount = await trpc.account.getAccount.query({
      address: wallet.address,
    });

    if (existingAccount) {
      log("info", "Account already registered", {
        address: wallet.address,
      });
      span.setAttribute("account.existed", true);
      return;
    }

    log("info", "Creating new account", { address: wallet.address });

    const message = await getCreateAccountMessage(actor, wallet.address);
    const signature = wallet.signMessage(message);

    const result = await trpc.account.createAccount.mutate({
      address: wallet.address,
      signature,
    });

    log("info", "Account created successfully", {
      address: wallet.address,
      principal: result.principal,
    });
    span.setAttribute("account.existed", false);
    span.setAttribute("account.principal", result.principal);
  });
}
