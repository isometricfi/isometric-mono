"use client";

import { motion } from "framer-motion";
import { Building2, FileLock2, KeyRound } from "lucide-react";
import { useTranslations } from "next-intl";

export function ProblemSection() {
  const t = useTranslations("Landing");

  const pains = [
    {
      icon: Building2,
      title: t("problem1Title"),
      description: t("problem1Desc"),
    },
    {
      icon: KeyRound,
      title: t("problem2Title"),
      description: t("problem2Desc"),
    },
    {
      icon: FileLock2,
      title: t("problem3Title"),
      description: t("problem3Desc"),
    },
  ];

  return (
    <section className="relative py-20 md:py-28">
      <div className="mx-auto max-w-5xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="mb-12 md:mb-16 max-w-3xl"
        >
          <div className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-muted-foreground mb-4">
            {t("problemEyebrow")}
          </div>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight leading-[1.1]">
            {t("problemTitle")}{" "}
            <span className="text-muted-foreground">{t("problemTitleSub")}</span>
          </h2>
        </motion.div>

        <div className="grid gap-6 md:grid-cols-3 md:gap-8">
          {pains.map((item, i) => (
            <motion.div
              key={item.title}
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: i * 0.1 }}
              viewport={{ once: true }}
              className="relative rounded-xl border border-border bg-card p-6"
            >
              <div className="mb-4 flex size-10 items-center justify-center rounded-lg bg-muted/60">
                <item.icon className="size-5 text-muted-foreground" />
              </div>
              <h3 className="mb-2 text-base font-semibold">{item.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{item.description}</p>
            </motion.div>
          ))}
        </div>

        <motion.p
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          viewport={{ once: true }}
          className="mt-10 md:mt-14 text-base md:text-lg text-center text-foreground/90"
        >
          {t("problemResolution")}
        </motion.p>
      </div>
    </section>
  );
}
