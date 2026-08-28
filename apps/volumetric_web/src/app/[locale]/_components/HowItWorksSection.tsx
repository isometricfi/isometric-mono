"use client";

import { motion } from "framer-motion";
import { TrendingUp, Zap } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { AnimatedToggle } from "@/components/navigation/AnimatedToggle";

export function HowItWorksSection() {
  const t = useTranslations("Landing");
  const [activeTab, setActiveTab] = useState<"writer" | "buyer">("buyer");

  const writerSteps = [
    {
      step: "01",
      title: t("writerStep1Title"),
      description: t("writerStep1Desc"),
    },
    {
      step: "02",
      title: t("writerStep2Title"),
      description: t("writerStep2Desc"),
    },
    {
      step: "03",
      title: t("writerStep3Title"),
      description: t("writerStep3Desc"),
    },
  ];

  const buyerSteps = [
    {
      step: "01",
      title: t("buyerStep1Title"),
      description: t("buyerStep1Desc"),
    },
    {
      step: "02",
      title: t("buyerStep2Title"),
      description: t("buyerStep2Desc"),
    },
    {
      step: "03",
      title: t("buyerStep3Title"),
      description: t("buyerStep3Desc"),
    },
  ];

  const steps = activeTab === "writer" ? writerSteps : buyerSteps;

  return (
    <section className="relative py-24 md:py-32">
      <div className="max-w-5xl mx-auto">
        {/* header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-8">
            {t("threeStepsTitle")}
          </h2>

          <AnimatedToggle
            options={[
              { value: "buyer", label: t("bet"), icon: Zap },
              { value: "writer", label: t("earn"), icon: TrendingUp },
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
      </div>
    </section>
  );
}
