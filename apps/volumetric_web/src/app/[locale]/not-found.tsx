import { Compass } from "lucide-react";
import { useTranslations } from "next-intl";
import { OpenAppLink } from "@/components/marketing/OpenAppLink";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  const t = useTranslations("NotFound");

  return (
    <div className="relative flex min-h-[80vh] flex-col items-center justify-center overflow-hidden py-16 md:py-24">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 flex items-center justify-center"
      >
        <div className="size-[520px] max-w-full rounded-full bg-primary/10 blur-3xl" />
      </div>

      <div className="relative z-10 mx-auto flex w-full max-w-2xl flex-col items-center text-center">
        <div className="relative mb-6 select-none">
          <span aria-hidden className="absolute inset-0 -z-10 bg-primary/30 blur-3xl" />
          <span className="block bg-gradient-to-b from-foreground to-foreground/40 bg-clip-text font-bold text-[clamp(7rem,22vw,14rem)] text-transparent leading-none tracking-tighter [animation:notfound-drift_8s_ease-in-out_infinite]">
            {t("code")}
          </span>
        </div>

        <h1 className="mb-4 font-bold text-3xl tracking-tight sm:text-4xl md:text-5xl">
          {t("heading")}
        </h1>

        <p className="mb-8 max-w-md text-base text-muted-foreground sm:text-lg">
          {t("description")}
        </p>

        <div className="flex justify-center">
          <OpenAppLink path="/buy">
            <Button size="lg">
              <Compass className="size-4" />
              {t("openApp")}
            </Button>
          </OpenAppLink>
        </div>
      </div>

      <style>{`
        @keyframes notfound-drift {
          0%, 100% { transform: translateY(0) rotate(-1deg); }
          50% { transform: translateY(-10px) rotate(1deg); }
        }
      `}</style>
    </div>
  );
}
