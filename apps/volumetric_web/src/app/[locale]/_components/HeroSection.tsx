import { Sparkles } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { HeroBgCanvas } from "./HeroBgCanvas";

export function HeroSection() {
  const t = useTranslations("Landing");

  return (
    <div className="relative flex min-h-[75vh] flex-col items-center justify-center">
      <HeroBgCanvas />
      <div className="relative z-10 max-w-5xl w-full text-center px-4">
        <div className="flex justify-center mb-6">
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-md bg-primary/10 text-primary text-sm font-medium tracking-wide">
            <Sparkles className="size-4" />
            {t("publicBeta")}
          </span>
        </div>

        <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.1] mb-6">
          {t("headline")}{" "}
          <span className="text-primary block sm:inline">{t("headlineHighlight")}</span>
        </h1>

        <h2 className="text-base md:text-xl text-muted-foreground max-w-2xl mx-auto">
          {t("subheadline")}
        </h2>
        <Link href={"/buy"}>
          <Button className="mt-8">{t("openApp")}</Button>
        </Link>
      </div>
    </div>
  );
}
