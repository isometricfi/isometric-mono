import {
  ACCEPT_OFFER_OUTCOME,
  type AcceptOfferResult,
  acceptOffer,
} from "./actions/accept-offer.js";
import { createOffer } from "./actions/create-offer.js";
import { setup } from "./actions/setup.js";
import { getCanisterActor } from "./canister-client.js";
import type { BotConfig } from "./config.js";
import { botLog, withBotSpan } from "./telemetry.js";
import type { TRPCFetch } from "./trpc-client.js";
import { getTRPCClient } from "./trpc-client.js";
import { createWallet } from "./wallet.js";

export const BOT_ACTION = {
  create: "create",
  accept: "accept",
} as const;

export type BotAction = (typeof BOT_ACTION)[keyof typeof BOT_ACTION];
const ACCEPT_FALLBACK_OUTCOMES = new Set<AcceptOfferResult["outcome"]>([
  ACCEPT_OFFER_OUTCOME.noOffers,
  ACCEPT_OFFER_OUTCOME.onlyOwnOffers,
  ACCEPT_OFFER_OUTCOME.noShortTermOffers,
  ACCEPT_OFFER_OUTCOME.noValidOffers,
]);

export interface BotRuntime {
  ensureSetup: () => Promise<void>;
  runAction: (action: BotAction) => Promise<void>;
  runActionWithResult: (action: BotAction) => Promise<BotActionResult>;
  runRandomAction: () => Promise<BotAction>;
}

export interface BotRuntimeOptions {
  trpcUrl?: string;
  trpcFetch?: TRPCFetch;
}

export type BotActionResult =
  | { ok: true; action: BotAction }
  | { ok: false; action: BotAction; error: string };

function shouldFallbackToCreate(outcome: AcceptOfferResult["outcome"]): boolean {
  return ACCEPT_FALLBACK_OUTCOMES.has(outcome);
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

  botLog("info", "Wallet initialized", { address: wallet.address });

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
    await runActionWithResult(action);
  };

  const runActionWithResult = async (action: BotAction): Promise<BotActionResult> => {
    iteration += 1;
    let actionError: string | null = null;

    await withBotSpan("bot.tick", { iteration, action, bot_name: config.botName }, async (span) => {
      try {
        await ensureSetup();

        if (action === BOT_ACTION.create) {
          botLog("info", "Tick: creating offer", { iteration });
          await createOffer(actor, trpc, wallet);
          return;
        }

        botLog("info", "Tick: accepting offer", { iteration });
        await acceptOffer(actor, trpc, wallet);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        botLog("error", "Tick failed", { iteration, error: message });
        span.setAttribute("error.message", message);
        actionError = message;
      }
    });

    if (actionError) {
      return { ok: false, action, error: actionError };
    }

    return { ok: true, action };
  };

  const runRandomAction = async (): Promise<BotAction> => {
    iteration += 1;
    let performedAction: BotAction = BOT_ACTION.accept;

    await withBotSpan(
      "bot.tick",
      { iteration, action: BOT_ACTION.accept, bot_name: config.botName },
      async (span) => {
        try {
          await ensureSetup();

          botLog("info", "Tick: accepting offer", { iteration });
          const acceptResult = await acceptOffer(actor, trpc, wallet);

          if (!shouldFallbackToCreate(acceptResult.outcome)) {
            return;
          }

          botLog("info", "Tick: no valid accept candidate, creating offer", {
            iteration,
            accept_outcome: acceptResult.outcome,
          });
          await createOffer(actor, trpc, wallet);
          performedAction = BOT_ACTION.create;
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          botLog("error", "Tick failed", { iteration, error: message });
          span.setAttribute("error.message", message);
        }
      },
    );

    return performedAction;
  };

  return {
    ensureSetup,
    runAction,
    runActionWithResult,
    runRandomAction,
  };
}
