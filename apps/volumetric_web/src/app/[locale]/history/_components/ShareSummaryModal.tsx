"use client";

import { Check, X as CloseIcon, Copy } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAccount, useHistory, useModal } from "@/hooks";
import { XIcon } from "@/lib/site-links";
import { landingPageUrl } from "@/lib/urls";
export function ShareSummaryModal() {
  const t = useTranslations("ShareSummary");
  const { closeModal } = useModal();
  const [copiedImage, setCopiedImage] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  const { data: history } = useHistory();
  const { data: account } = useAccount();

  if (!account?.profile || !history) return null;

  const address = account.profile.address;
  const shareCode = account.profile.inviteCode ?? address;
  const shareUrl = `/s/${shareCode}`;
  const landingPageAbsoluteShareUrl = landingPageUrl(shareUrl);
  const absoluteShareUrl = landingPageAbsoluteShareUrl.startsWith("http")
    ? landingPageAbsoluteShareUrl
    : typeof window !== "undefined"
      ? window.location.origin + shareUrl
      : shareUrl;
  const ogImageUrl = `/api/og/${address}`;

  const entries = history.entries ?? [];
  const totalPnlSats = entries.reduce((sum, e) => sum + e.pnlSats, BigInt(0));
  const totalTrades = entries.length;
  const profitableTrades = entries.filter((e) => e.result === "profit").length;
  const winRate = totalTrades > 0 ? (profitableTrades / totalTrades) * 100 : 0;

  const twitterText = encodeURIComponent(
    t("twitterText", {
      pnl: (Number(totalPnlSats) / 100_000_000).toFixed(6),
      winRate: winRate.toFixed(1),
      trades: totalTrades,
    }),
  );
  const twitterUrl = `https://twitter.com/intent/tweet?text=${twitterText}&url=${encodeURIComponent(absoluteShareUrl)}`;

  const handleCopyImage = async () => {
    try {
      const response = await fetch(ogImageUrl);
      const blob = await response.blob();
      await navigator.clipboard.write([
        new ClipboardItem({
          [blob.type]: blob,
        }),
      ]);
      setCopiedImage(true);
      setTimeout(() => setCopiedImage(false), 2000);
    } catch (error) {
      console.error("Failed to copy image:", error);
    }
  };

  const handleShareOnX = () => {
    window.open(twitterUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">{t("title")}</h2>
        <Button variant="ghost" size="icon" onClick={closeModal}>
          <CloseIcon className="size-4" />
        </Button>
      </div>

      <div className="rounded-md overflow-hidden bg-card relative aspect-1200/630">
        {!imageLoaded && <Skeleton className="absolute inset-0 w-full h-full" />}
        {/* biome-ignore lint: using native img for dynamically generated OG image */}
        <img
          src={ogImageUrl}
          alt={t("tradingStats")}
          className="w-full h-full object-contain"
          onLoad={() => setImageLoaded(true)}
        />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Button variant="outline" size="lg" onClick={handleShareOnX}>
          <XIcon className="size-4" />
          {t("shareOnX")}
        </Button>

        <CopyButton text={absoluteShareUrl} size="lg" className="w-full">
          {t("copyLink")}
        </CopyButton>

        <Button variant="outline" size="lg" onClick={handleCopyImage}>
          {copiedImage ? <Check className="size-4" /> : <Copy className="size-4" />}
          {t("copyImage")}
        </Button>
      </div>
    </div>
  );
}
