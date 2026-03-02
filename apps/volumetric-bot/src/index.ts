import "dotenv/config";
import { createBotRuntime } from "./bot.js";
import { loadNodeConfig } from "./config.js";
import { initTelemetry, log, shutdownTelemetry, withSpan } from "./telemetry.js";

async function main() {
  const config = loadNodeConfig();

  initTelemetry(config.botName, {
    ...process.env,
    OTEL_SERVICE_NAME: process.env.OTEL_SERVICE_NAME ?? "volumetric-bot",
  });

  log("info", "Bot starting", {
    bot_name: config.botName,
    btc_network: config.btcNetwork,
    interval_ms: config.intervalMs,
  });

  const botRuntime = await createBotRuntime(config);

  const command = process.argv[2] ?? "run";

  switch (command) {
    case "setup": {
      await botRuntime.ensureSetup();
      break;
    }

    case "create-offer": {
      await botRuntime.runAction("create");
      break;
    }

    case "accept-offer": {
      await botRuntime.runAction("accept");
      break;
    }

    case "run": {
      log("info", "Starting main loop", { interval_ms: config.intervalMs });

      let timeoutId: NodeJS.Timeout | null = null;
      let isShuttingDown = false;

      const tick = async () => {
        await withSpan("bot.run_loop", { bot_name: config.botName }, async () => {
          await botRuntime.runRandomAction();
        });
      };

      const scheduleNextTick = () => {
        if (isShuttingDown) {
          return;
        }

        timeoutId = setTimeout(() => {
          void runScheduledTick();
        }, config.intervalMs);
      };

      const runScheduledTick = async () => {
        if (isShuttingDown) {
          return;
        }

        try {
          await tick();
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          log("error", "Run loop tick failed", { error: message });
        }

        scheduleNextTick();
      };

      // Run first tick immediately
      await tick();

      // Schedule next tick only after the prior one completes.
      scheduleNextTick();

      // Graceful shutdown
      const shutdown = async () => {
        if (isShuttingDown) {
          return;
        }

        isShuttingDown = true;
        log("info", "Shutting down");
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
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
