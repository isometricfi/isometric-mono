"use client";

import { isBitcoinWallet } from "@dynamic-labs/bitcoin";
import { useDynamicContext } from "@dynamic-labs/sdk-react-core";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useBtcAddress } from "@/hooks/use-btc-address";
import { useCanister } from "@/hooks/use-canister";

export function CkbtcWallet() {
  const { primaryWallet } = useDynamicContext();
  const canister = useCanister();
  const address = useBtcAddress("payment");

  const [depositAmount, setDepositAmount] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawBtcAddress, setWithdrawBtcAddress] = useState("");

  const { data: accountInfo, isLoading: isLoadingAccount } = useQuery({
    queryKey: ["account", address],
    queryFn: async () => {
      if (!canister || !address) return null;
      const result = await canister.get_account_info(address);
      return result.length > 0 ? result[0] : null;
    },
    enabled: !!canister && !!address,
  });

  const {
    data: depositInfo,
    isLoading: isLoadingDeposit,
    refetch: refetchDeposit,
  } = useQuery({
    queryKey: ["depositAddress", address],
    queryFn: async () => {
      if (!canister || !address) return null;
      const result = await canister.get_deposit_address(address);
      if ("Err" in result) {
        throw new Error(JSON.stringify(result.Err));
      }
      return result.Ok;
    },
    enabled: !!canister && !!address && !!accountInfo,
  });

  const {
    data: balance,
    isLoading: isLoadingBalance,
    refetch: refetchBalance,
  } = useQuery({
    queryKey: ["ckbtcBalance", address],
    queryFn: async () => {
      if (!canister || !address) return null;
      const result = await canister.get_ckbtc_balance(address);
      if ("Err" in result) {
        throw new Error(JSON.stringify(result.Err));
      }
      return result.Ok;
    },
    enabled: !!canister && !!address && !!accountInfo,
    refetchInterval: 30000,
  });

  const updateBalanceMutation = useMutation({
    mutationFn: async () => {
      if (!canister || !address) throw new Error("Not ready");
      const result = await canister.update_ckbtc_balance(address);
      if ("Err" in result) {
        throw new Error(JSON.stringify(result.Err));
      }
      return result.Ok;
    },
    onSuccess: () => {
      refetchBalance();
    },
  });

  const depositMutation = useMutation({
    mutationFn: async () => {
      if (!depositInfo) throw new Error("Deposit address not loaded");
      if (!primaryWallet || !isBitcoinWallet(primaryWallet)) {
        throw new Error("Bitcoin wallet not connected");
      }
      if (!depositAmount) throw new Error("Enter deposit amount");

      const amount = BigInt(depositAmount);
      if (amount < BigInt(5000)) {
        throw new Error("Minimum deposit is 5000 sats");
      }

      const txid = await primaryWallet.sendBitcoin({
        amount,
        recipientAddress: depositInfo.btc_address,
      });

      if (!txid) throw new Error("Transaction failed");
      return txid;
    },
    onSuccess: () => {
      setDepositAmount("");
    },
  });

  const withdrawMutation = useMutation({
    mutationFn: async () => {
      if (!canister || !address) throw new Error("Not ready");
      if (!primaryWallet || !isBitcoinWallet(primaryWallet)) {
        throw new Error("Bitcoin wallet not connected");
      }
      if (!withdrawAmount || !withdrawBtcAddress) throw new Error("Missing fields");

      const amount = BigInt(withdrawAmount);
      const message = await canister.get_withdraw_message(address, withdrawBtcAddress, amount);
      const signature = await primaryWallet.signMessage(message, { addressType: "payment" });

      if (!signature) {
        throw new Error("Failed to sign message");
      }

      const result = await canister.withdraw_ckbtc({
        data: {
          btc_address: withdrawBtcAddress,
          amount,
        },
        wallet_proof: {
          address,
          signature,
        },
      });

      if ("Err" in result) {
        throw new Error(JSON.stringify(result.Err));
      }
      return result.Ok;
    },
    onSuccess: () => {
      refetchBalance();
      setWithdrawAmount("");
      setWithdrawBtcAddress("");
    },
  });

  if (!primaryWallet) {
    return <div className="text-zinc-500 text-sm">Connect your Bitcoin wallet first</div>;
  }

  if (isLoadingAccount) {
    return <div className="text-zinc-500 text-sm">Loading account...</div>;
  }

  if (!accountInfo) {
    return (
      <div className="text-zinc-500 text-sm">Create an account first to access ckBTC features</div>
    );
  }

  const formatSats = (sats: bigint | null | undefined) => {
    if (sats === null || sats === undefined) return "—";
    const btc = Number(sats) / 100_000_000;
    return `${sats.toLocaleString()} sats (${btc.toFixed(8)} BTC)`;
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        <h3 className="text-lg font-medium text-zinc-200">Balance</h3>
        <div className="flex items-center gap-4">
          <div className="flex-1 p-4 bg-zinc-800 rounded-lg">
            <div className="text-sm text-zinc-500 mb-1">ckBTC Balance</div>
            <div className="text-xl font-mono">
              {isLoadingBalance ? "Loading..." : formatSats(balance)}
            </div>
          </div>
          <button
            type="button"
            onClick={() => refetchBalance()}
            disabled={isLoadingBalance}
            className="px-4 py-2 bg-zinc-700 text-zinc-200 rounded-lg hover:bg-zinc-600 disabled:opacity-50 transition-colors"
          >
            Refresh
          </button>
        </div>
      </div>

      <div className="border-t border-zinc-800" />

      <div className="flex flex-col gap-4">
        <h3 className="text-lg font-medium text-zinc-200">Deposit BTC → ckBTC</h3>
        <p className="text-sm text-zinc-500">
          Send BTC to the address below. After 6 confirmations, click &quot;Check for Deposits&quot;
          to mint ckBTC.
        </p>

        {isLoadingDeposit ? (
          <div className="text-zinc-500 text-sm">Loading deposit address...</div>
        ) : depositInfo ? (
          <>
            <div className="flex flex-col gap-2">
              <span className="text-sm text-zinc-500">BTC Deposit Address</span>
              <code className="text-xs bg-zinc-800 p-3 rounded break-all font-mono select-all">
                {depositInfo.btc_address}
              </code>
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="deposit-amount" className="text-sm text-zinc-500">
                Deposit Amount (satoshis, min 5000)
              </label>
              <input
                id="deposit-amount"
                type="number"
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                placeholder="10000"
                min="5000"
                className="w-full bg-zinc-800 border border-zinc-700 rounded px-4 py-2 focus:outline-none focus:border-zinc-600"
              />
            </div>

            <button
              type="button"
              onClick={() => depositMutation.mutate()}
              disabled={depositMutation.isPending || !depositAmount}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {depositMutation.isPending ? "Sending..." : "Send Deposit"}
            </button>

            {depositMutation.isSuccess && depositMutation.data && (
              <div className="p-3 bg-green-950 border border-green-800 rounded-lg">
                <div className="text-sm text-green-400 mb-2">Transaction Sent!</div>
                <div className="text-xs text-zinc-300">
                  TXID: <code className="break-all">{depositMutation.data}</code>
                </div>
                <p className="text-xs text-zinc-500 mt-2">
                  Wait for 6 confirmations, then click &quot;Check for Deposits&quot; below.
                </p>
              </div>
            )}

            {depositMutation.isError && (
              <div className="p-3 bg-red-950 border border-red-800 rounded-lg">
                <div className="text-sm text-red-400">{depositMutation.error?.message}</div>
              </div>
            )}

            <div className="border-t border-zinc-700 my-2" />

            <button
              type="button"
              onClick={() => updateBalanceMutation.mutate()}
              disabled={updateBalanceMutation.isPending}
              className="px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {updateBalanceMutation.isPending ? "Checking..." : "Check for Deposits"}
            </button>

            {updateBalanceMutation.isSuccess && updateBalanceMutation.data && (
              <div className="p-3 bg-green-950 border border-green-800 rounded-lg">
                <div className="text-sm text-green-400 mb-2">Deposit Result</div>
                <pre className="text-xs text-zinc-300 overflow-auto">
                  {JSON.stringify(
                    updateBalanceMutation.data,
                    (_, v) => (typeof v === "bigint" ? v.toString() : v),
                    2,
                  )}
                </pre>
              </div>
            )}

            {updateBalanceMutation.isError && (
              <div className="p-3 bg-red-950 border border-red-800 rounded-lg">
                <div className="text-sm text-red-400">{updateBalanceMutation.error?.message}</div>
              </div>
            )}
          </>
        ) : (
          <button
            type="button"
            onClick={() => refetchDeposit()}
            className="px-4 py-2 bg-zinc-700 text-zinc-200 rounded-lg hover:bg-zinc-600 transition-colors"
          >
            Get Deposit Address
          </button>
        )}
      </div>

      <div className="border-t border-zinc-800" />

      <div className="flex flex-col gap-4">
        <h3 className="text-lg font-medium text-zinc-200">Withdraw ckBTC → BTC</h3>
        <p className="text-sm text-zinc-500">
          Convert ckBTC back to real BTC. Withdrawals are processed by the ckBTC minter.
        </p>

        <div className="flex flex-col gap-2">
          <label htmlFor="withdraw-amount" className="text-sm text-zinc-500">
            Amount (satoshis)
          </label>
          <input
            id="withdraw-amount"
            type="number"
            value={withdrawAmount}
            onChange={(e) => setWithdrawAmount(e.target.value)}
            placeholder="10000"
            className="w-full bg-zinc-800 border border-zinc-700 rounded px-4 py-2 focus:outline-none focus:border-zinc-600"
          />
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="withdraw-address" className="text-sm text-zinc-500">
            Destination BTC Address
          </label>
          <input
            id="withdraw-address"
            type="text"
            value={withdrawBtcAddress}
            onChange={(e) => setWithdrawBtcAddress(e.target.value)}
            placeholder="bc1q.../tb1q..."
            className="w-full bg-zinc-800 border border-zinc-700 rounded px-4 py-2 focus:outline-none focus:border-zinc-600"
          />
        </div>

        <button
          type="button"
          onClick={() => withdrawMutation.mutate()}
          disabled={withdrawMutation.isPending || !withdrawAmount || !withdrawBtcAddress}
          className="px-4 py-2 bg-orange-600 text-white rounded-lg font-medium hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {withdrawMutation.isPending ? "Processing..." : "Withdraw ckBTC"}
        </button>

        {withdrawMutation.isSuccess && withdrawMutation.data && (
          <div className="p-3 bg-green-950 border border-green-800 rounded-lg">
            <div className="text-sm text-green-400 mb-1">Withdrawal Submitted</div>
            <div className="text-xs text-zinc-300">
              Block Index: {withdrawMutation.data.block_index.toString()}
            </div>
          </div>
        )}

        {withdrawMutation.isError && (
          <div className="p-3 bg-red-950 border border-red-800 rounded-lg">
            <div className="text-sm text-red-400">{withdrawMutation.error?.message}</div>
          </div>
        )}
      </div>
    </div>
  );
}
