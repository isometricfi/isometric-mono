"use client";

import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { FinalCtaBgCanvas } from "./FinalCtaBgCanvas";

export function FinalCtaSection() {
  const t = useTranslations("Landing");

  return (
    <section className="relative py-20 md:py-32">
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
              {t("finalCtaTitle")}
            </h2>
            <p className="text-muted-foreground text-base md:text-lg mb-8 max-w-xl mx-auto">
              {t("finalCtaSubtitle")}
            </p>
            <Link href="/buy">
              <Button size="lg" className="gap-2">
                {t("openApp")}
                <ArrowRight className="size-4" />
              </Button>
            </Link>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
