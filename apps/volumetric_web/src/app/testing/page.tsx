"use client";

import { useState } from "react";
import { createActor } from "@volumetric/canister-types";

const CANISTER_ID = process.env.NEXT_PUBLIC_CANISTER_ID;
const IC_HOST = process.env.NEXT_PUBLIC_IC_HOST || "https://ic0.app";

export default function TestingPage() {
  const [name, setName] = useState("World");
  const [response, setResponse] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGreet = async () => {
    if (!CANISTER_ID) {
      setError("NEXT_PUBLIC_CANISTER_ID not set");
      return;
    }

    setLoading(true);
    setError(null);
    setResponse(null);

    try {
      const actor = createActor(CANISTER_ID, {
        agentOptions: { host: IC_HOST },
      });

      const result = await actor.greet(name);
      setResponse(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-8">
      <div className="max-w-xl mx-auto space-y-8">
        <h1 className="text-3xl font-bold">Canister Test</h1>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-zinc-400 mb-2">Canister ID</label>
            <code className="block bg-zinc-900 px-4 py-2 rounded text-sm font-mono">
              {CANISTER_ID || "Not configured"}
            </code>
          </div>

          <div>
            <label className="block text-sm text-zinc-400 mb-2">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 rounded px-4 py-2 focus:outline-none focus:border-zinc-600"
            />
          </div>

          <button
            onClick={handleGreet}
            disabled={loading}
            className="w-full bg-zinc-100 text-zinc-900 font-medium py-2 px-4 rounded hover:bg-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Calling..." : "Call greet()"}
          </button>
        </div>

        {response && (
          <div className="bg-green-950 border border-green-800 rounded p-4">
            <div className="text-sm text-green-400 mb-1">Response</div>
            <div className="font-mono">{response}</div>
          </div>
        )}

        {error && (
          <div className="bg-red-950 border border-red-800 rounded p-4">
            <div className="text-sm text-red-400 mb-1">Error</div>
            <div className="font-mono text-sm">{error}</div>
          </div>
        )}
      </div>
    </div>
  );
}

