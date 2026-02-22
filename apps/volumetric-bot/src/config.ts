export interface BotConfig {
  privateKeyWif: string;
  trpcUrl?: string;
  canisterId: string;
  icHost: string;
  btcNetwork: "mainnet" | "testnet";
  intervalMs: number;
  botName: string;
}

export interface BotEnv {
  [key: string]: string | undefined;
  BOT_PRIVATE_KEY_WIF?: string;
  TRPC_URL?: string;
  CANISTER_ID?: string;
  IC_HOST?: string;
  BTC_NETWORK?: string;
  INTERVAL_MS?: string;
  BOT_NAME?: string;
}

function requireEnv(env: BotEnv, name: keyof BotEnv): string {
  const value = env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function loadConfig(env: BotEnv): BotConfig {
  const btcNetwork = env.BTC_NETWORK ?? "mainnet";
  if (btcNetwork !== "mainnet" && btcNetwork !== "testnet") {
    throw new Error(`BTC_NETWORK must be "mainnet" or "testnet", got "${btcNetwork}"`);
  }

  return {
    privateKeyWif: requireEnv(env, "BOT_PRIVATE_KEY_WIF"),
    trpcUrl: env.TRPC_URL,
    canisterId: requireEnv(env, "CANISTER_ID"),
    icHost: env.IC_HOST ?? "https://ic0.app",
    btcNetwork,
    intervalMs: Number(env.INTERVAL_MS ?? "60000"),
    botName: env.BOT_NAME ?? "bot-1",
  };
}

export function loadNodeConfig(): BotConfig {
  const config = loadConfig(process.env);
  if (!config.trpcUrl) {
    throw new Error("Missing required environment variable: TRPC_URL");
  }
  return config;
}
