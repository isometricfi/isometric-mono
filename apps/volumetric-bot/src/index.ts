import { acceptOffer } from "./actions/accept-offer.js";
import { createOffer } from "./actions/create-offer.js";
import { setup } from "./actions/setup.js";
import { getCanisterActor } from "./canister-client.js";
import { loadConfig } from "./config.js";
import { initTelemetry, log, shutdownTelemetry, withSpan } from "./telemetry.js";
import { getTRPCClient } from "./trpc-client.js";
import { createWallet } from "./wallet.js";

async function main() {
  const config = loadConfig();

  initTelemetry(config.botName);

  log("info", "Bot starting", {
    bot_name: config.botName,
    btc_network: config.btcNetwork,
    interval_ms: config.intervalMs,
  });

  const wallet = createWallet(config.privateKeyWif, config.btcNetwork);
  log("info", "Wallet initialized", { address: wallet.address });

  const actor = await getCanisterActor(config.canisterId, config.icHost);
  const trpc = getTRPCClient(config.trpcUrl);

  const command = process.argv[2] ?? "run";

  switch (command) {
    case "setup": {
      await setup(actor, trpc, wallet);
      break;
    }

    case "create-offer": {
      await setup(actor, trpc, wallet);
      await createOffer(actor, trpc, wallet);
      break;
    }

    case "accept-offer": {
      await setup(actor, trpc, wallet);
      await acceptOffer(actor, trpc, wallet);
      break;
    }

    case "run": {
      await setup(actor, trpc, wallet);
      log("info", "Starting main loop", { interval_ms: config.intervalMs });

      let iteration = 0;

      const randomAction = (): "create" | "accept" => {
        return Math.random() < 0.5 ? "create" : "accept";
      };

      const tick = async () => {
        iteration++;
        const action = randomAction();

        await withSpan(
          "bot.tick",
          { iteration, action, bot_name: config.botName },
          async (span) => {
            try {
              if (action === "create") {
                log("info", "Tick: creating offer", { iteration });
                await createOffer(actor, trpc, wallet);
              } else {
                log("info", "Tick: accepting offer", { iteration });
                await acceptOffer(actor, trpc, wallet);
              }
            } catch (error) {
              const message = error instanceof Error ? error.message : String(error);
              log("error", "Tick failed", { iteration, error: message });
              span.setAttribute("error.message", message);
            }
          },
        );
      };

      // Run first tick immediately
      await tick();

      // Set up interval
      const intervalId = setInterval(tick, config.intervalMs);

      // Graceful shutdown
      const shutdown = async () => {
        log("info", "Shutting down");
        clearInterval(intervalId);
        await shutdownTelemetry();
        process.exit(0);
      };

      process.on("SIGINT", shutdown);
      process.on("SIGTERM", shutdown);

      break;
    }

    default: {
      console.error(`Unknown command: ${command}`);
      console.error("Usage: volumetric-bot [setup|create-offer|accept-offer|run]");
      process.exit(1);
    }
  }

  if (command !== "run") {
    await shutdownTelemetry();
  }
}

main().catch(async (error) => {
  console.error("Fatal error:", error);
  await shutdownTelemetry();
  process.exit(1);
});
