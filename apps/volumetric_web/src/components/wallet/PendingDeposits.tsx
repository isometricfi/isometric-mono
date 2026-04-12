"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, ExternalLink, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import type { PendingDeposit } from "@/hooks";
import { usePendingDeposits } from "@/hooks";
import { formatBtcWithSymbol } from "@/lib/utils";

const REQUIRED_CONFIRMATIONS = 4;

const DOT_KEYS = ["dot-0", "dot-1", "dot-2", "dot-3"] as const;

function ConfirmationDots({ confirmations }: { confirmations: number }) {
  const clamped = Math.min(confirmations, REQUIRED_CONFIRMATIONS);
  return (
    <div className="flex gap-0.5">
      {DOT_KEYS.map((key, idx) => (
        <div
          key={key}
          className={`size-2 rounded-[2px] transition-colors duration-500 ${
            idx < clamped ? "bg-primary" : "bg-muted-foreground/30"
          }`}
        />
      ))}
    </div>
  );
}

function StatusText({
  deposit,
  t,
}: {
  deposit: PendingDeposit;
  t: ReturnType<typeof useTranslations<"PendingDeposits">>;
}) {
  switch (deposit.status) {
    case "unconfirmed":
      return <span className="text-muted-foreground">{t("unconfirmed")}</span>;
    case "confirming":
      return (
        <span className="text-muted-foreground">
          {t("confirming", { count: deposit.confirmations })}
        </span>
      );
    case "processing":
      return (
        <span className="flex items-center gap-1 text-muted-foreground">{t("processing")}</span>
      );
  }
}

function DepositRow({ deposit }: { deposit: PendingDeposit }) {
  const t = useTranslations("PendingDeposits");
  const mempoolBaseUrl = process.env.NEXT_PUBLIC_MEMPOOL_URL;
  const txUrl = mempoolBaseUrl ? `${mempoolBaseUrl}/tx/${deposit.txid}` : null;

  const content = (
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-2 min-w-0">
        <span className="font-medium text-foreground">
          {formatBtcWithSymbol(deposit.valueSats)}
        </span>
        <StatusText deposit={deposit} t={t} />
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <ConfirmationDots confirmations={deposit.confirmations} />
        <ExternalLink className="size-3 text-muted-foreground/50" />
      </div>
    </div>
  );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="text-xs"
    >
      {txUrl ? (
        <a
          href={txUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="block py-1.5 -mx-1 px-1 rounded hover:bg-secondary/50 transition-colors"
        >
          {content}
        </a>
      ) : (
        <div className="py-1.5">{content}</div>
      )}
    </motion.div>
  );
}

export function PendingDeposits() {
  const { deposits } = usePendingDeposits();
  const t = useTranslations("PendingDeposits");
  const [expanded, setExpanded] = useState(false);

  if (deposits.length === 0) return null;

  const totalSats = deposits.reduce((sum, d) => sum + d.valueSats, 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
      className="rounded-lg border border-border/50 bg-secondary/30 overflow-hidden"
    >
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2.5 text-sm hover:bg-secondary/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Loader2 className="size-3.5 animate-spin text-card-foreground" />
          <span className="font-medium">{`${formatBtcWithSymbol(totalSats)} ${t("pending")}`}</span>
        </div>
        <motion.div animate={{ rotate: expanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown className="size-3.5 text-muted-foreground" />
        </motion.div>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: "auto" }}
            exit={{ height: 0 }}
            transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-2.5 space-y-0.5 border-t border-border/30 pt-1.5">
              <AnimatePresence mode="popLayout">
                {deposits.map((deposit) => (
                  <DepositRow key={`${deposit.txid}:${deposit.vout}`} deposit={deposit} />
                ))}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
