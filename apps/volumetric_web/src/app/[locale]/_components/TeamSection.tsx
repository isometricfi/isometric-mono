"use client";

import { motion } from "framer-motion";
import { Linkedin } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";

type Member = {
  name: string;
  role: string;
  bio: string;
  image: string;
  linkedin: string;
};

export function TeamSection() {
  const t = useTranslations("Landing");

  const members: Member[] = [
    {
      name: "Luke Bowles",
      role: t("teamLukeRole"),
      bio: t("teamLukeBio"),
      image: "/landing/luke-profile.jpg",
      linkedin: "https://www.linkedin.com/in/luke-bowles-sa/",
    },
    {
      name: "Dylan van Heerden",
      role: t("teamDylanRole"),
      bio: t("teamDylanBio"),
      image: "/landing/dylan-profile.jpg",
      linkedin: "https://www.linkedin.com/in/dylanvanheerden/",
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
          className="mb-10 md:mb-14 text-center"
        >
          <div className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-muted-foreground mb-3">
            {t("teamEyebrow")}
          </div>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight">{t("teamTitle")}</h2>
        </motion.div>

        <div className="grid gap-4 md:gap-6 sm:grid-cols-2 max-w-3xl mx-auto">
          {members.map((m, i) => (
            <motion.div
              key={m.name}
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: i * 0.1 }}
              viewport={{ once: true }}
              className="relative rounded-xl border border-border bg-card p-5 md:p-6"
            >
              <div className="flex items-start gap-4">
                <Image
                  src={m.image}
                  alt={m.name}
                  width={72}
                  height={72}
                  className="rounded-full size-14 md:size-16 object-cover shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="font-semibold text-base truncate">{m.name}</h3>
                    </div>
                    <a
                      href={m.linkedin}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`${m.name} LinkedIn`}
                      className="shrink-0 text-muted-foreground transition-colors hover:text-primary"
                    >
                      <Linkedin className="size-4" />
                    </a>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{m.bio}</p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {m.role}{" "}
                    <a
                      href="https://liquidium.fi"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline underline-offset-2 hover:text-primary transition-colors"
                    >
                      Liquidium
                    </a>
                  </p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
