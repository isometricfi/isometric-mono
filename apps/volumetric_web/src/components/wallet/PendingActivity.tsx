"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowDownLeft, ArrowUpRight, ChevronDown, ExternalLink, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import type { PendingWithdrawal } from "@/hooks";
import { type PendingDeposit, usePendingDeposits, usePendingWithdrawals } from "@/hooks";
import { formatBtcWithSymbol } from "@/lib/utils";

const DEPOSIT_REQUIRED_CONFIRMATIONS = 4;
const WITHDRAWAL_REQUIRED_CONFIRMATIONS = 1;
const DOT_KEYS = ["dot-0", "dot-1", "dot-2", "dot-3"] as const;

type ActivityRow = {
  id: string;
  direction: "in" | "out";
  amountSats: number;
  link: string | null;
  sortKey: number;
} & (
  | { kind: "deposit"; deposit: PendingDeposit }
  | { kind: "withdrawal"; withdrawal: PendingWithdrawal }
);

function ConfirmationDots({
  confirmations,
  required,
}: {
  confirmations: number;
  required: number;
}) {
  const clamped = Math.min(confirmations, required);
  return (
    <div className="flex gap-0.5">
      {DOT_KEYS.slice(0, required).map((key, idx) => (
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

function DepositStatusText({ deposit }: { deposit: PendingDeposit }) {
  const t = useTranslations("PendingDeposits");
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
      return <span className="text-muted-foreground">{t("processing")}</span>;
  }
}

function WithdrawalStatusText({ withdrawal }: { withdrawal: PendingWithdrawal }) {
  const t = useTranslations("PendingWithdrawals");
  switch (withdrawal.status) {
    case "broadcasting":
      return <span className="text-muted-foreground">{t("broadcasting")}</span>;
    case "pending":
      return (
        <span className="text-muted-foreground">
          {t("confirming", { count: withdrawal.confirmations })}
        </span>
      );
  }
}

function ActivityRowView({ row }: { row: ActivityRow }) {
  const DirectionIcon = row.direction === "in" ? ArrowDownLeft : ArrowUpRight;
  const isWithdrawalBroadcasting =
    row.kind === "withdrawal" && row.withdrawal.status === "broadcasting";

  const content = (
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-2 min-w-0">
        <DirectionIcon className="size-3 text-muted-foreground/70 shrink-0" />
        <span className="font-medium text-foreground">{formatBtcWithSymbol(row.amountSats)}</span>
        {row.kind === "deposit" ? (
          <DepositStatusText deposit={row.deposit} />
        ) : (
          <WithdrawalStatusText withdrawal={row.withdrawal} />
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {row.kind === "deposit" ? (
          <ConfirmationDots
            confirmations={row.deposit.confirmations}
            required={DEPOSIT_REQUIRED_CONFIRMATIONS}
          />
        ) : isWithdrawalBroadcasting ? (
          <Loader2 className="size-3 animate-spin text-muted-foreground" />
        ) : (
          <ConfirmationDots
            confirmations={row.withdrawal.confirmations}
            required={WITHDRAWAL_REQUIRED_CONFIRMATIONS}
          />
        )}
        {row.link && <ExternalLink className="size-3 text-muted-foreground/50" />}
      </div>
    </div>
  );

  const className = "block py-1.5 -mx-1 px-1 rounded hover:bg-secondary/50 transition-colors";

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="text-xs"
    >
      {row.link ? (
        <a href={row.link} target="_blank" rel="noopener noreferrer" className={className}>
          {content}
        </a>
      ) : (
        <div className={className}>{content}</div>
      )}
    </motion.div>
  );
}

function buildActivityRows(
  deposits: PendingDeposit[],
  withdrawals: PendingWithdrawal[],
  mempoolBaseUrl: string,
): ActivityRow[] {
  const depositRows: ActivityRow[] = deposits.map((deposit) => ({
    kind: "deposit",
    id: `deposit:${deposit.txid}:${deposit.vout}`,
    direction: "in",
    amountSats: deposit.valueSats,
    link: `${mempoolBaseUrl}/tx/${deposit.txid}`,
    sortKey: deposit.confirmations,
    deposit,
  }));

  const withdrawalRows: ActivityRow[] = withdrawals.map((withdrawal) => ({
    kind: "withdrawal",
    id: `withdrawal:${withdrawal.operationId}`,
    direction: "out",
    amountSats: withdrawal.amountSats,
    link: withdrawal.bitcoinTxid ? `${mempoolBaseUrl}/tx/${withdrawal.bitcoinTxid}` : null,
    sortKey: withdrawal.createdAtMs,
    withdrawal,
  }));

  return [...depositRows, ...withdrawalRows].sort((a, b) => a.sortKey - b.sortKey);
}

export function PendingActivity() {
  const { deposits } = usePendingDeposits();
  const { withdrawals } = usePendingWithdrawals();
  const t = useTranslations("PendingActivity");
  const [expanded, setExpanded] = useState(false);

  const mempoolBaseUrl = process.env.NEXT_PUBLIC_MEMPOOL_URL ?? "https://mempool.space";

  const rows = useMemo(
    () => buildActivityRows(deposits, withdrawals, mempoolBaseUrl),
    [deposits, withdrawals, mempoolBaseUrl],
  );

  if (rows.length === 0) return null;

  const inProgress =
    deposits.length > 0 || withdrawals.some((withdrawal) => withdrawal.status === "broadcasting");

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
          {inProgress ? (
            <Loader2 className="size-3.5 animate-spin text-card-foreground" />
          ) : (
            <ArrowDownLeft className="size-3.5 text-card-foreground" />
          )}
          <span className="font-medium">{t("title", { count: rows.length })}</span>
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
                {rows.map((row) => (
                  <ActivityRowView key={row.id} row={row} />
                ))}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
