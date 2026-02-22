import "dotenv/config";

export interface BotConfig {
  privateKeyWif: string;
  trpcUrl: string;
  canisterId: string;
  icHost: string;
  btcNetwork: "mainnet" | "testnet";
  intervalMs: number;
  botName: string;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function loadConfig(): BotConfig {
  const btcNetwork = process.env.BTC_NETWORK ?? "mainnet";
  if (btcNetwork !== "mainnet" && btcNetwork !== "testnet") {
    throw new Error(`BTC_NETWORK must be "mainnet" or "testnet", got "${btcNetwork}"`);
  }

  return {
    privateKeyWif: requireEnv("BOT_PRIVATE_KEY_WIF"),
    trpcUrl: requireEnv("TRPC_URL"),
    canisterId: requireEnv("CANISTER_ID"),
    icHost: process.env.IC_HOST ?? "https://ic0.app",
    btcNetwork,
    intervalMs: Number(process.env.INTERVAL_MS ?? "60000"),
    botName: process.env.BOT_NAME ?? "bot-1",
  };
}
