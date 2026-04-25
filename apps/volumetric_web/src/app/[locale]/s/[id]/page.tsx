import { Lock, TrendingUp, Zap } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { getHistoryByHash } from "@/lib/use-cases/history/get-history-by-hash/usecase";
import { cn, formatBtcWithSymbolBigint, getFallbackUsername } from "@/lib/utils";
import { CaptureInviteCode } from "./_components/CaptureInviteCode";
import { ShareCta } from "./_components/ShareCta";

type SharePageParams = Promise<{ id: string; locale: string }>;

export async function generateMetadata({ params }: { params: SharePageParams }): Promise<Metadata> {
  const { id, locale } = await params;
  const t = await getTranslations({ locale, namespace: "Metadata.share" });
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://isometric.fi";
  const ogImageUrl = `${baseUrl}/api/og/${id}?locale=${locale}`;

  return {
    title: t("title"),
    description: t("description"),
    keywords: t("keywords")
      .split(",")
      .map((k) => k.trim()),
    openGraph: {
      title: t("ogTitle"),
      description: t("description"),
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 630,
          alt: t("ogImageAlt"),
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: t("ogTitle"),
      description: t("description"),
      images: [ogImageUrl],
    },
  };
}

export default async function SharePage({ params }: { params: SharePageParams }) {
  const { id, locale } = await params;
  const t = await getTranslations({ locale, namespace: "SharePage" });
  const history = await getHistoryByHash(id);
  const entries = history?.entries ?? [];
  const username = history?.username ?? getFallbackUsername(id, locale);
  const avatarSeed = history?.address ?? id;

  const hasHistory = entries.length > 0;

  const totalPnlSats = hasHistory ? entries.reduce((sum, e) => sum + e.pnlSats, BigInt(0)) : null;
  const profitableTrades = hasHistory ? entries.filter((e) => e.result === "profit").length : 0;
  const winRate = hasHistory ? (profitableTrades / entries.length) * 100 : null;
  const totalVolumeSats = hasHistory
    ? entries.reduce((sum, e) => sum + e.quantitySats, BigInt(0))
    : null;
  const isPnlPositive = totalPnlSats !== null && totalPnlSats >= BigInt(0);

  const sortedEntries = hasHistory
    ? [...entries].sort((a, b) => Number(a.acceptedAt - b.acceptedAt))
    : [];
  const firstTrade = sortedEntries[0];
  const joinedDate = firstTrade
    ? new Date(Number(firstTrade.acceptedAt) * 1_000).toLocaleDateString(locale, {
        month: "long",
        year: "numeric",
      })
    : null;

  const pnlDisplay =
    totalPnlSats !== null
      ? isPnlPositive
        ? `+${formatBtcWithSymbolBigint(totalPnlSats, 6)}`
        : formatBtcWithSymbolBigint(totalPnlSats, 6)
      : null;

  const headlineKey = hasHistory ? "headline" : "emptyHeadline";
  const subheadlineKey = hasHistory ? "subheadline" : "emptySubheadline";

  return (
    <div className="container mx-auto md:py-8 py-6 max-w-xl space-y-5">
      <CaptureInviteCode id={id} />
      {/* Hero headline */}
      <div className="text-center space-y-2 px-2">
        <h1 className="md:text-3xl text-2xl font-bold tracking-tight">
          {t.rich(headlineKey, {
            username,
            primary: (chunks) => <span className="text-primary">{chunks}</span>,
          })}
        </h1>
        <p className="text-muted-foreground md:text-sm text-xs leading-relaxed max-w-md mx-auto">
          {t(subheadlineKey, { username })}
        </p>
      </div>

      {/* Profile card */}
      <div className="rounded-xl border bg-card p-5 space-y-4">
        {/* Profile row */}
        <div className="flex items-center gap-3">
          <Image
            src={`/api/avatar?name=${avatarSeed}`}
            alt="Avatar"
            width={44}
            height={44}
            className="rounded-full shrink-0"
          />
          <div className="flex-1 min-w-0">
            <p className="font-semibold truncate">{username}</p>
            <p className="text-xs text-muted-foreground">
              {joinedDate ? t("joinedAt", { date: joinedDate }) : t("newMember")}
              {hasHistory ? ` · ${t("tradesCount", { count: entries.length })}` : null}
            </p>
          </div>
          {winRate !== null && (
            <div className="text-right shrink-0">
              <p className="text-xs text-muted-foreground">{t("winRateLabel")}</p>
              <p className="text-lg font-bold text-primary">{winRate.toFixed(0)}%</p>
            </div>
          )}
        </div>

        {/* P&L + volume — only when trades exist */}
        {pnlDisplay !== null && totalVolumeSats !== null && (
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-muted/40 px-4 py-3">
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">
                {t("totalPnlLabel")}
              </p>
              <p
                className={cn(
                  "md:text-xl text-lg font-bold tabular-nums",
                  isPnlPositive ? "text-green-500" : "text-destructive",
                )}
              >
                {pnlDisplay}
              </p>
            </div>
            <div className="rounded-lg bg-muted/40 px-4 py-3">
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">
                {t("volumeLabel")}
              </p>
              <p className="md:text-xl text-lg font-bold tabular-nums">
                {formatBtcWithSymbolBigint(totalVolumeSats, 5)}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Why Isometric + CTA */}
      <div className="rounded-xl border bg-card p-5 space-y-5">
        <div className="space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
            {t("whyIsometric")}
          </p>
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <Zap className="size-4 text-primary mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium">{t("leverageTitle")}</p>
                <p className="text-xs text-muted-foreground">{t("leverageDesc")}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <TrendingUp className="size-4 text-primary mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium">{t("yieldTitle")}</p>
                <p className="text-xs text-muted-foreground">{t("yieldDesc")}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Lock className="size-4 text-primary mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium">{t("custodialTitle")}</p>
                <p className="text-xs text-muted-foreground">{t("custodialDesc")}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <ShareCta />
        </div>
      </div>
    </div>
  );
}
