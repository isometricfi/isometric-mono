"use client";

import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { WaitlistForm } from "@/components/marketing/WaitlistForm";
import { Button } from "@/components/ui/button";
import { isWaitlistMode } from "@/lib/site-links";
import { appUrl } from "@/lib/urls";
import { FinalCtaBgCanvas } from "./FinalCtaBgCanvas";

export function FinalCtaSection() {
  const t = useTranslations("Landing");
  const waitlistMode = isWaitlistMode();

  return (
    <section className="relative py-20 md:py-32" id={waitlistMode ? "waitlist" : undefined}>
      <div className="mx-auto max-w-4xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="relative overflow-hidden rounded-2xl border border-border bg-card px-6 py-14 md:px-14 md:py-20 text-center"
        >
          <FinalCtaBgCanvas />
          <div className="pointer-events-none absolute inset-x-0 -top-20 h-40 bg-primary/10 blur-3xl" />
          <div className="relative">
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight leading-[1.1] mb-4">
              {waitlistMode ? t("waitlistTitle") : t("finalCtaTitle")}
            </h2>
            <p className="text-muted-foreground text-base md:text-lg mb-8 max-w-xl mx-auto">
              {waitlistMode ? t("waitlistSubtitle") : t("finalCtaSubtitle")}
            </p>
            {waitlistMode ? (
              <div className="flex justify-center">
                <WaitlistForm size="lg" />
              </div>
            ) : (
              <a href={appUrl("/buy")}>
                <Button size="lg" className="gap-2">
                  {t("openApp")}
                  <ArrowRight className="size-4" />
                </Button>
              </a>
            )}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
