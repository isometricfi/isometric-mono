import { acceptOffer } from "./actions/accept-offer.js";
import { createOffer } from "./actions/create-offer.js";
import { setup } from "./actions/setup.js";
import { getCanisterActor } from "./canister-client.js";
import type { BotConfig } from "./config.js";
import { log, withSpan } from "./telemetry.js";
import type { TRPCFetch } from "./trpc-client.js";
import { getTRPCClient } from "./trpc-client.js";
import { createWallet } from "./wallet.js";

export type BotAction = "create" | "accept";

export interface BotRuntime {
  ensureSetup: () => Promise<void>;
  runAction: (action: BotAction) => Promise<void>;
  runRandomAction: () => Promise<BotAction>;
}

export interface BotRuntimeOptions {
  trpcUrl?: string;
  trpcFetch?: TRPCFetch;
}

function randomAction(): BotAction {
  return Math.random() < 0.5 ? "create" : "accept";
}

export async function createBotRuntime(
  config: BotConfig,
  options?: BotRuntimeOptions,
): Promise<BotRuntime> {
  const wallet = createWallet(config.privateKeyWif, config.btcNetwork);
  const actor = await getCanisterActor(config.canisterId, config.icHost);
  const trpcUrl = options?.trpcUrl ?? config.trpcUrl;

  if (!trpcUrl) {
    throw new Error("Missing tRPC URL for bot runtime");
  }

  const trpc = getTRPCClient({
    trpcUrl,
    fetch: options?.trpcFetch,
  });

  log("info", "Wallet initialized", { address: wallet.address });

  let setupCompleted = false;
  let iteration = 0;

  const ensureSetup = async (): Promise<void> => {
    if (setupCompleted) {
      return;
    }

    await setup(actor, trpc, wallet);
    setupCompleted = true;
  };

  const runAction = async (action: BotAction): Promise<void> => {
    iteration += 1;

    await withSpan("bot.tick", { iteration, action, bot_name: config.botName }, async (span) => {
      try {
        await ensureSetup();

        if (action === "create") {
          log("info", "Tick: creating offer", { iteration });
          await createOffer(actor, trpc, wallet);
          return;
        }

        log("info", "Tick: accepting offer", { iteration });
        await acceptOffer(actor, trpc, wallet);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        log("error", "Tick failed", { iteration, error: message });
        span.setAttribute("error.message", message);
      }
    });
  };

  const runRandomAction = async (): Promise<BotAction> => {
    const action = randomAction();
    await runAction(action);
    return action;
  };

  return {
    ensureSetup,
    runAction,
    runRandomAction,
  };
}
