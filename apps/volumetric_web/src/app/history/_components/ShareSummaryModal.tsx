"use client";

import { Check, Download, X as XIcon } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import { useAccount, useHistory, useModal } from "@/hooks";
import { hashPrincipal } from "@/lib/utils";

export function ShareSummaryModal() {
  const { closeModal } = useModal();
  const [copiedImage, setCopiedImage] = useState(false);

  const { data: history } = useHistory();
  const { data: account } = useAccount();

  if (!account?.profile || !history) return null;

  const principal = account.profile.principal;
  const principalHash = hashPrincipal(principal);
  const shareUrl = `/s/${principalHash}`;
  const absoluteShareUrl =
    typeof window !== "undefined" ? window.location.origin + shareUrl : shareUrl;
  const ogImageUrl = `/api/og/${principalHash}`;

  const entries = history.entries ?? [];
  const totalPnlSats = entries.reduce((sum, e) => sum + e.pnlSats, BigInt(0));
  const totalTrades = entries.length;
  const profitableTrades = entries.filter((e) => e.result === "profit").length;
  const winRate = (profitableTrades / totalTrades) * 100;

  const twitterText = encodeURIComponent(
    `Check out my trading stats on Isometric! 📈\n\n${(Number(totalPnlSats) / 100_000_000).toFixed(6)} BTC P&L | ${winRate.toFixed(1)}% Win Rate | ${totalTrades} Trades`,
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Share Your Stats</h2>
        <Button variant="ghost" size="icon" onClick={closeModal}>
          <XIcon className="size-4" />
        </Button>
      </div>

      <div className="rounded-xl overflow-hidden border bg-card relative aspect-[1200/630]">
        <Image src={ogImageUrl} alt="Trading Stats" fill className="object-contain" />
      </div>

      <div className="space-y-3">
        <Button className="w-full" size="lg" onClick={handleShareOnX}>
          {" "}
          Share on X
        </Button>

        <div className="grid grid-cols-2 gap-3">
          <CopyButton text={absoluteShareUrl} className="w-full h-full">
            Copy Link
          </CopyButton>

          <Button variant="outline" size="lg" onClick={handleCopyImage}>
            {copiedImage ? <Check className="size-4" /> : <Download className="size-4" />}
            Copy Image
          </Button>
        </div>
      </div>
    </div>
  );
}
