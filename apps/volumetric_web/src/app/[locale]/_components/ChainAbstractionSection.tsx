"use client";

import { motion } from "framer-motion";
import { ArrowRight, KeyRound, Layers } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

export function ChainAbstractionSection() {
  const t = useTranslations("Landing");

  return (
    <section className="relative py-24 md:py-32 bg-muted/30">
      <div className="max-w-5xl mx-auto">
        <div className="flex md:flex-row flex-col gap-5 md:gap-10 w-full">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className=""
          >
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-6">
              {t("nativeBitcoin")}
              <br />
              <span className="text-muted-foreground">{t("smartContractPower")}</span>
            </h2>
            <p className="text-muted-foreground leading-relaxed mb-8">
              {t("chainAbstractionDescription")}
            </p>
            <div className="flex items-center gap-4">
              <Button variant="outline" size="sm" className="gap-2" asChild>
                <a
                  href="https://wiki.internetcomputer.org/wiki/Chain-key_Bitcoin"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {t("learnMore")}
                  <ArrowRight className="size-3" />
                </a>
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
  const t = useTranslations("Landing");

  return (
    <div className="relative h-full grid grid-cols-1 md:grid-cols-3 items-center justify-center gap-3">
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
            <div className="text-xs text-muted-foreground">{t("bitcoin")}</div>
            <div className="text-sm font-semibold">{t("yourBtc")}</div>
          </div>
        </div>
        <div className="text-[10px] font-mono text-muted-foreground">bc1q...x7f9</div>
      </motion.div>

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
            <div className="text-xs text-muted-foreground">{t("chainKey")}</div>
            <div className="text-sm font-semibold whitespace-nowrap">{t("oneToOneVerified")}</div>
          </div>
        </div>

        <div className="text-[10px] text-muted-foreground">{t("cryptographicProof")}</div>
      </motion.div>

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
            <div className="text-xs text-muted-foreground">{t("contract")}</div>
            <div className="text-sm font-semibold">{t("options")}</div>
          </div>
        </div>
        <div className="text-[10px] font-mono text-muted-foreground">{t("autoSettlement")}</div>
      </motion.div>
    </div>
  );
}
