"use client";

import { motion } from "framer-motion";
import { ArrowRight, Layers, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ChainAbstractionSection() {
  return (
    <section className="relative px-4 py-24 md:py-32 bg-muted/30">
      <div className="max-w-5xl mx-auto">
        <div className="flex md:flex-row flex-col gap-5 md:gap-10 w-full">
          {/* left - content */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className=""
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium mb-6">
              <Layers className="size-3" />
              Chain Abstraction
            </div>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-6">
              Native Bitcoin.
              <br />
              <span className="text-muted-foreground">
                Smart contract power.
              </span>
            </h2>
            <p className="text-muted-foreground leading-relaxed mb-8">
              Powered by ICP's chain-key technology, Volumetric bridges the gap
              between Bitcoin's security and programmable smart contracts. Your
              BTC never leaves the Bitcoin network—it's represented 1:1 on-chain
              with full cryptographic verification.
            </p>
            <div className="flex items-center gap-4">
              <Button variant="outline" size="sm" className="gap-2">
                Learn more
                <ArrowRight className="size-3" />
              </Button>
            </div>
          </motion.div>

          {/* right - visual */}
          <div className="w-full md:w-fit md:min-w-[500px]">
            <ChainAbstractionVisual />
          </div>
        </div>
      </div>
    </section>
  );
}

function ChainAbstractionVisual() {
  return (
    <div className="relative h-full grid grid-cols-1 md:grid-cols-3 items-center justify-center gap-3">
      {/* bitcoin side */}
      <motion.div
        className="bg-card rounded-xl border border-border p-4 md:w-auto w-full"
        initial={{ opacity: 0, x: 0 }}
        whileInView={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        viewport={{ once: true }}
      >
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-lg bg-[#F7931A]/10 flex items-center justify-center text-[#F7931A] font-bold">
            ₿
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Bitcoin</div>
            <div className="text-sm font-semibold">Your BTC</div>
          </div>
        </div>
        <div className="text-[10px] font-mono text-muted-foreground">
          bc1q...x7f9
        </div>
      </motion.div>

      {/* center - chain key */}
      <motion.div
        className="relative z-10 bg-card rounded-xl border border-primary/30 p-4"
        initial={{ opacity: 0, scale: 0.9 }}
        whileInView={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, delay: 0.4 }}
        viewport={{ once: true }}
      >
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center ">
            <KeyRound className="size-5 text-green-500" />
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Chain-Key</div>
            <div className="text-sm font-semibold">1:1 Verified</div>
          </div>
        </div>

        <div className="text-[10px] text-muted-foreground">
          Cryptographic proof
        </div>
      </motion.div>

      {/* smart contract side */}
      <motion.div
        className=" md:right-8 bg-card rounded-xl border border-border p-4"
        initial={{ opacity: 0, x: 0 }}
        whileInView={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5, delay: 0.6 }}
        viewport={{ once: true }}
      >
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Layers className="size-5 text-primary" />
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Contract</div>
            <div className="text-sm font-semibold">Options</div>
          </div>
        </div>
        <div className="text-[10px] font-mono text-muted-foreground">
          Auto-settlement
        </div>
      </motion.div>
    </div>
  );
}
