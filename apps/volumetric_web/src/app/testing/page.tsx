"use client";

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { createActor } from "@volumetric/canister-types";
import { BtcWallet } from "@/components/btc-wallet";

interface Config {
  canisterId: string | undefined;
  icHost: string;
}

async function fetchConfig(): Promise<Config> {
  const res = await fetch("/api/config");
  if (!res.ok) throw new Error("Failed to load config");
  return res.json();
}

export default function TestingPage() {
  const [name, setName] = useState("World");

  const {
    data: config,
    isLoading: configLoading,
    error: configError,
  } = useQuery({
    queryKey: ["config"],
    queryFn: fetchConfig,
  });

  const greetMutation = useMutation({
    mutationFn: async (name: string) => {
      if (!config?.canisterId) {
        throw new Error("CANISTER_ID not set");
      }
      const actor = createActor(config.canisterId, {
        agentOptions: { host: config.icHost },
      });
      return actor.greet(name);
    },
  });

  const handleGreet = () => {
    greetMutation.mutate(name);
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-8">
      <div className="max-w-4xl mx-auto space-y-12">
        <h1 className="text-3xl font-bold">Testing</h1>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-zinc-300">
            Bitcoin Wallet (Dynamic)
          </h2>
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
            <BtcWallet />
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-zinc-300">Canister Test</h2>
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 space-y-4">
            <div>
              <label className="block text-sm text-zinc-400 mb-2">
                Canister ID
              </label>
              <code className="block bg-zinc-800 px-4 py-2 rounded text-sm font-mono">
                {config?.canisterId || "Not configured"}
              </code>
            </div>
            <div>
              <label className="block text-sm text-zinc-400 mb-2">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded px-4 py-2 focus:outline-none focus:border-zinc-600"
              />
            </div>

            <button
              onClick={handleGreet}
              disabled={greetMutation.isPending || configLoading}
              className="w-full bg-zinc-100 text-zinc-900 font-medium py-2 px-4 rounded hover:bg-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {greetMutation.isPending ? "Calling..." : "Call greet()"}
            </button>

            {greetMutation.data && (
              <div className="bg-green-950 border border-green-800 rounded p-4">
                <div className="text-sm text-green-400 mb-1">Response</div>
                <div className="font-mono">{greetMutation.data}</div>
              </div>
            )}

            {(greetMutation.error || configError) && (
              <div className="bg-red-950 border border-red-800 rounded p-4">
                <div className="text-sm text-red-400 mb-1">Error</div>
                <div className="font-mono text-sm">
                  {greetMutation.error?.message || configError?.message}
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

