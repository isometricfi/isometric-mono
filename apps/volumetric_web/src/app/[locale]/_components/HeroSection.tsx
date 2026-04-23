import { Sparkles } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { HeroBgCanvas } from "./HeroBgCanvas";

export function HeroSection() {
  const t = useTranslations("Landing");

  return (
    <div className="relative flex min-h-[94vh] flex-col items-center justify-center py-20 md:py-24">
      <HeroBgCanvas />
      <div className="relative z-10 mx-auto w-full max-w-5xl md:-mt-20">
        <div className="grid grid-cols-1 items-center gap-12 md:grid-cols-[1.1fr_1fr] md:gap-10 lg:gap-16">
          <div className="text-center md:text-left">
            <div className="flex justify-center md:justify-start mb-6">
              <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-md bg-primary/10 text-primary text-sm font-medium tracking-wide">
                <Sparkles className="size-4" />
                {t("publicBeta")}
              </span>
            </div>

            <h1 className="text-4xl sm:text-5xl md:text-5xl lg:text-6xl xl:text-7xl font-bold tracking-tight leading-[1.05] mb-6">
              {t("headline")} <br />
              <span className="text-primary">{t("headlineHighlight")}</span>
            </h1>

            <h2 className="font-semibold text-base md:text-lg lg:text-xl text-muted-foreground sm:max-w-xl mx-auto md:mx-0 max-w-[210px] ">
              {t("subheadline")}
            </h2>
            <Link href={"/buy"}>
              <Button className="mt-8">{t("openApp")}</Button>
            </Link>
          </div>

          <div className="relative mx-auto w-full max-w-[300px] sm:max-w-[340px] md:max-w-[380px]">
            <div className="pointer-events-none absolute -inset-8 bg-primary/10 blur-3xl rounded-full" />
            <div className="relative ">
              <Image
                src="/landing/demo-light.png"
                alt={t("headline")}
                width={896}
                height={1120}
                priority
                fetchPriority="high"
                sizes="(min-width: 768px) 40vw, 80vw"
                className="block dark:hidden w-full h-auto drop-shadow-2xl rounded-lg md:rounded-xl overflow-clip"
              />
              <Image
                src="/landing/demo-dark.png"
                alt={t("headline")}
                width={896}
                height={1120}
                priority
                fetchPriority="high"
                sizes="(min-width: 768px) 40vw, 80vw"
                className="hidden dark:block w-full h-auto drop-shadow-2xl rounded-lg md:rounded-xl overflow-clip "
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
