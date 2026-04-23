import { Bitcoin, Globe, Infinity as InfinityIcon, Link2 } from "lucide-react";
import { useTranslations } from "next-intl";

export function SocialProofStrip() {
  const t = useTranslations("Landing");

  const items = [
    { icon: InfinityIcon, label: t("builtOnIcp") },
    { icon: Bitcoin, label: t("nativeBtc") },
    { icon: Link2, label: t("onChain") },
    { icon: Globe, label: t("permissionless") },
  ];

  return (
    <section className="relative z-10 -mx-4 border-y border-border/60 bg-muted/20">
      <div className="mx-auto max-w-5xl px-4 py-5">
        <div className="grid md:grid-cols-4 grid-cols-2 items-center justify-center  gap-y-4">
          {items.map(({ icon: Icon, label }) => (
            <div
              key={label}
              className="flex items-center gap-2 text-xs md:text-sm text-muted-foreground md:justify-center"
            >
              <Icon className="size-4 text-primary" />
              <span className="font-medium tracking-wide">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
