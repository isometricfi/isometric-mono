import "dotenv/config";
import { createBotRuntime } from "./bot.js";
import { loadNodeConfig } from "./config.js";
import { initTelemetry, log, shutdownTelemetry, withSpan } from "./telemetry.js";

async function main() {
  const config = loadNodeConfig();

  initTelemetry(config.botName, process.env);

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

      const tick = async () => {
        await withSpan("bot.run_loop", { bot_name: config.botName }, async () => {
          await botRuntime.runRandomAction();
        });
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
