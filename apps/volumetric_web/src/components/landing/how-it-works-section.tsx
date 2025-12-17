"use client";

import { motion } from "framer-motion";
import { ArrowRight, Clock, TrendingUp, Zap } from "lucide-react";
import { useState } from "react";
import { AnimatedToggle } from "@/components/navigation/animated-toggle";
import { Button } from "@/components/ui/button";

export function HowItWorksSection() {
  const [activeTab, setActiveTab] = useState<"writer" | "buyer">("writer");

  const writerSteps = [
    {
      step: "01",
      title: "Deposit Collateral",
      description:
        "Connect your wallet and deposit BTC as collateral. Funds are held in non-custodial smart contracts.",
    },
    {
      step: "02",
      title: "Write Options",
      description:
        "Select expiry, strike price, and size. Set your premium and list your covered call for buyers.",
    },
    {
      step: "03",
      title: "Collect Premium",
      description:
        "Earn yield instantly when buyers purchase your contracts. At expiry, collateral settles automatically.",
    },
  ];

  const buyerSteps = [
    {
      step: "01",
      title: "Connect & Deposit",
      description:
        "Link your wallet and deposit BTC. Your balance is used to pay premiums when purchasing options.",
    },
    {
      step: "02",
      title: "Browse & Purchase",
      description:
        "Explore available contracts by expiry and strike. Pay the premium from your balance to lock in exposure.",
    },
    {
      step: "03",
      title: "Automatic Settlement",
      description:
        "At expiry, profits are credited to your balance automatically. No manual claiming required.",
    },
  ];

  const steps = activeTab === "writer" ? writerSteps : buyerSteps;

  return (
    <section className="relative px-4 py-24 md:py-32">
      <div className="max-w-5xl mx-auto">
        {/* header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-muted text-muted-foreground text-xs font-medium mb-6">
            <Clock className="size-3" />
            Getting Started
          </div>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-8">
            Three steps to start trading
          </h2>

          {/* toggle */}
          <AnimatedToggle
            options={[
              { value: "writer", label: "Writers", icon: TrendingUp },
              { value: "buyer", label: "Buyers", icon: Zap },
            ]}
            value={activeTab}
            onChange={setActiveTab}
          />
        </motion.div>

        {/* steps */}
        <div className="grid md:grid-cols-3 gap-8 md:gap-12">
          {steps.map((item, i) => (
            <motion.div
              key={item.step}
              className="relative"
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: i === 0 ? 0.3 : i * 0.4 }}
              viewport={{ once: true }}
            >
              <div key={item.step} className="relative">
                <div className="text-4xl font-bold text-muted-foreground/20 mb-4 font-mono">
                  {item.step}
                </div>
                <h3 className="text-lg font-semibold mb-2">{item.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{item.description}</p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* cta */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          viewport={{ once: true }}
          className="flex justify-center mt-16"
        >
          <Button size="lg" className="gap-2">
            {activeTab === "writer" ? "Start Earning" : "Start Trading"}
            <ArrowRight className="size-4" />
          </Button>
        </motion.div>
      </div>
    </section>
  );
}
