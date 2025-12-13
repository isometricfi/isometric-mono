"use client";

import { isBitcoinWallet } from "@dynamic-labs/bitcoin";
import { useDynamicContext } from "@dynamic-labs/sdk-react-core";
import { useState } from "react";
import { useDynamicConfig } from "@/app/providers/dynamic-provider";
import { useBtcAddresses } from "@/hooks/use-btc-address";

export function BtcWallet() {
  const { isConfigured } = useDynamicConfig();

  if (!isConfigured) {
    return (
      <div className="flex flex-col gap-2 p-4 rounded-lg border border-yellow-500/50 bg-yellow-500/10">
        <span className="text-sm font-medium text-yellow-500">Dynamic not configured</span>
        <span className="text-xs text-zinc-400">
          Set NEXT_PUBLIC_DYNAMIC_ENVIRONMENT_ID in your .env.local file
        </span>
      </div>
    );
  }

  return <BtcWalletInner />;
}

function BtcWalletInner() {
  const { primaryWallet, user } = useDynamicContext();
  const addresses = useBtcAddresses();
  const [signature, setSignature] = useState<string | null>(null);
  const [message, setMessage] = useState("Hello from Volumetric");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const signMessage = async () => {
    setError(null);
    setSignature(null);

    if (!primaryWallet) {
      setError("No wallet connected");
      return;
    }

    if (!isBitcoinWallet(primaryWallet)) {
      setError("Connected wallet is not a Bitcoin wallet");
      return;
    }

    setIsLoading(true);
    try {
      const sig = await primaryWallet.signMessage(message, { addressType: "payment" });
      if (sig) {
        setSignature(sig);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to sign message");
    } finally {
      setIsLoading(false);
    }
  };

  if (!primaryWallet) {
    return (
      <div className="flex flex-col gap-2 p-4 rounded-lg border border-zinc-700 bg-zinc-800/50">
        <span className="text-sm text-zinc-400">
          Connect your wallet using the button in the navbar
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 w-full max-w-md">
      <div className="flex flex-col gap-1">
        <span className="text-sm text-zinc-500">Primary Address</span>
        <code className="text-xs bg-zinc-100 dark:bg-zinc-900 p-2 rounded break-all">
          {primaryWallet.address}
        </code>
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-sm text-zinc-500">Additional Addresses (raw)</span>
        <code className="text-xs bg-zinc-100 dark:bg-zinc-900 p-2 rounded break-all whitespace-pre-wrap">
          {JSON.stringify(
            (primaryWallet as unknown as { additionalAddresses?: unknown }).additionalAddresses,
            null,
            2,
          ) ?? "none"}
        </code>
      </div>

      {addresses.payment && (
        <div className="flex flex-col gap-1">
          <span className="text-sm text-green-500 font-medium">
            Payment Address (bc1q.../tb1q...)
          </span>
          <code className="text-xs bg-zinc-100 dark:bg-zinc-900 p-2 rounded break-all">
            {addresses.payment}
          </code>
        </div>
      )}

      {addresses.ordinals && (
        <div className="flex flex-col gap-1">
          <span className="text-sm text-purple-500">Ordinals Address (bc1p.../tb1p...)</span>
          <code className="text-xs bg-zinc-100 dark:bg-zinc-900 p-2 rounded break-all">
            {addresses.ordinals}
          </code>
        </div>
      )}

      {user?.email && (
        <div className="flex flex-col gap-1">
          <span className="text-sm text-zinc-500">Email</span>
          <span className="text-sm">{user.email}</span>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <label htmlFor="message" className="text-sm text-zinc-500">
          Message to Sign
        </label>
        <textarea
          id="message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="p-2 rounded border border-zinc-200 dark:border-zinc-800 bg-transparent text-sm resize-none"
          rows={3}
        />
      </div>

      <button
        type="button"
        onClick={signMessage}
        disabled={isLoading || !message}
        className="px-4 py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isLoading ? "Signing..." : "Sign Message"}
      </button>

      {signature && (
        <div className="flex flex-col gap-1">
          <span className="text-sm text-zinc-500">Signature</span>
          <code className="text-xs bg-zinc-100 dark:bg-zinc-900 p-2 rounded break-all">
            {signature}
          </code>
        </div>
      )}

      {error && (
        <div className="text-sm text-red-500 p-2 bg-red-50 dark:bg-red-950 rounded">{error}</div>
      )}
    </div>
  );
}
