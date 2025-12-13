import { useQuery } from "@tanstack/react-query";
import { createActor, _SERVICE } from "@volumetric/canister-types";

interface Config {
  canisterId: string | undefined;
  icHost: string;
}

async function fetchConfig(): Promise<Config> {
  const res = await fetch("/api/config");
  if (!res.ok) throw new Error("Failed to load config");
  return res.json();
}

export function useCanisterConfig() {
  return useQuery({
    queryKey: ["config"],
    queryFn: fetchConfig,
  });
}

export function useCanister(): _SERVICE | null {
  const { data: config } = useCanisterConfig();

  if (!config?.canisterId) {
    return null;
  }

  return createActor(config.canisterId, {
    agentOptions: { host: config.icHost },
  });
}







