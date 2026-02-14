"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, Loader2, ThumbsUp, Users, Wallet } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { useVoteFeatureInterest } from "@/hooks/mutations/use-vote-feature-interest";
import { useBtcAddress } from "@/hooks/queries/use-btc-address";
import {
  type FeatureInterestKey,
  useFeatureInterestStatus,
} from "@/hooks/queries/use-feature-interest-status";
import { cn } from "@/lib/utils";
import { Badge } from "../ui/badge";

interface FeatureInterestButtonProps {
  featureKey: FeatureInterestKey;
}

export function FeatureInterestButton({ featureKey }: FeatureInterestButtonProps) {
  const t = useTranslations("Pages");
  const address = useBtcAddress("payment");
  const { data, isLoading } = useFeatureInterestStatus(featureKey);
  const voteMutation = useVoteFeatureInterest(featureKey);

  const isWalletConnected = !!address;
  const hasVoted = data?.hasVoted ?? false;
  const totalInterested = data?.totalInterested ?? 0;
  const isSubmitting = voteMutation.isPending;

  const isDisabled = !isWalletConnected || hasVoted || isSubmitting || isLoading;

  const buttonLabel = hasVoted
    ? t("featureInterestRegistered")
    : isSubmitting
      ? t("featureInterestRegistering")
      : t("featureInterestRegister");

  return (
    <div className="flex flex-col items-center gap-4">
      <Button
        onClick={() => voteMutation.mutate()}
        disabled={isDisabled}
        size="lg"
        className={cn(
          "gap-2 min-w-[180px] transition-all duration-300",
          hasVoted &&
            "text-green-800 border-green-300 bg-green-100 hover:bg-green-100 hover:text-green-700 dark:bg-green-950/20 dark:border-green-900 dark:text-green-400 dark:hover:bg-green-950/30",
        )}
      >
        <AnimatePresence mode="wait" initial={false}>
          {isSubmitting ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.5 }}
            >
              <Loader2 className="size-4 animate-spin" />
            </motion.div>
          ) : hasVoted ? (
            <motion.div
              key="voted"
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.5 }}
            >
              <Check className="size-4" />
            </motion.div>
          ) : (
            <motion.div
              key="idle"
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.5 }}
            >
              <ThumbsUp className="size-4" />
            </motion.div>
          )}
        </AnimatePresence>
        <span className="relative">
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={buttonLabel}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              transition={{ duration: 0.15 }}
            >
              {buttonLabel}
            </motion.span>
          </AnimatePresence>
        </span>
      </Button>

      {!isWalletConnected ? (
        <Badge variant="secondary">
          <Wallet className="size-3.5 shrink-0" />
          <span>{t("featureInterestWalletRequired")}</span>
        </Badge>
      ) : (
        <Badge variant="secondary">
          <Users className="size-3.5" />
          <span>{t("featureInterestCount", { count: totalInterested })}</span>
        </Badge>
      )}
    </div>
  );
}
