import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "@/i18n/routing";

export function PauseModeNotice() {
  const t = useTranslations("PauseMode");

  return (
    <Card className="max-w-xl mx-auto mt-10">
      <CardContent className="flex flex-col items-center text-center gap-4 p-5">
        <div className="flex flex-col gap-2">
          <h2 className="text-lg md:text-xl font-bold leading-tight">{t("title")}</h2>
          <p className="text-sm text-muted-foreground leading-relaxed max-w-sm">
            {t("description")}
          </p>
        </div>
        <Button asChild>
          <Link href="/portfolio">{t("cta")}</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
