"use client";

import { useState } from "react";
import { BtcWallet } from "./_components/BtcWallet";
import { CkbtcWallet } from "./_components/CkbtcWallet";
import { CreateAccount } from "./_components/CreateAccount";
import { OptionsTrading } from "./_components/OptionsTrading";
import { Settlement } from "./_components/Settlement";
import { SyncBalance } from "./_components/SyncBalance";

type Tab = "wallet" | "options" | "settlement" | "admin";

export default function TestingPage() {
  const [activeTab, setActiveTab] = useState<Tab>("wallet");

  const tabs: { id: Tab; label: string }[] = [
    { id: "wallet", label: "Wallet" },
    { id: "options", label: "Options" },
    { id: "settlement", label: "Settlement" },
    { id: "admin", label: "Admin" },
  ];

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold">Testing</h1>

        <div className="flex gap-2 border-b border-zinc-800 pb-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-t-lg font-medium transition-colors ${
                activeTab === tab.id
                  ? "bg-zinc-800 text-zinc-100"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === "wallet" && (
          <div className="space-y-8">
            <section className="space-y-4">
              <h2 className="text-xl font-semibold text-zinc-300">Bitcoin Wallet</h2>
              <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
                <BtcWallet />
              </div>
            </section>

            <section className="space-y-4">
              <h2 className="text-xl font-semibold text-zinc-300">Create Account</h2>
              <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
                <CreateAccount />
              </div>
            </section>

            <section className="space-y-4">
              <h2 className="text-xl font-semibold text-zinc-300">ckBTC Wallet</h2>
              <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
                <CkbtcWallet />
              </div>
            </section>
          </div>
        )}

        {activeTab === "options" && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-zinc-300">Options Trading</h2>
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
              <OptionsTrading />
            </div>
          </div>
        )}

        {activeTab === "settlement" && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-zinc-300">Settlement</h2>
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
              <Settlement />
            </div>
          </div>
        )}

        {activeTab === "admin" && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-zinc-300">Admin: Sync Balance</h2>
            <p className="text-sm text-zinc-500">
              Sync internal balance with actual ckBTC ledger balance. Whitelisted only.
            </p>
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
              <SyncBalance />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
