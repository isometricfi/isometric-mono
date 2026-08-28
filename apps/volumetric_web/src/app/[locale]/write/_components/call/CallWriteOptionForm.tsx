"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { BtcUsdAmountSection } from "@/components/options/BtcUsdAmountSection";
import { OfferResultModal } from "@/components/options/OfferResultModal";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { NumberCarousel } from "@/components/ui/number-carousel";
import { DepositModal } from "@/components/wallet/DepositModal";
import { getNiceErrorMessage } from "@/lib/error-message";
import { formatUsd } from "@/lib/utils";
import { useCallWriteOptionFormModel } from "./_internal/use-call-write-option-form-model";
import { CallWriteOptionSummary } from "./CallWriteOptionSummary";
import { WriteEarningsSection } from "./WriteEarningsSection";

export function CallWriteOptionForm() {
  const [depositModalOpen, setDepositModalOpen] = useState(false);
  const t = useTranslations("Forms");
  const {
    acceptOffer,
    amountSats,
    btcPrice,
    competitivenessRankDisplay,
    showLargestIndicator,
    earningsSats,
    getButtonText,
    handleAmountSatsChange,
    handleModalClose,
    handlePremiumPercentChange,
    handleStrikeUsdChange,
    handleSubmit,
    isSubmitDisabled,
    maxCreateOfferAmountSats,
    needDepositMore,
    premiumPercent,
    premiumValues,
    selectedStrikePercent,
    selectedStrikeUsd,
    selectedTermDay,
    setTerm,
    showModal,
    strikeUsdValues,
    termDays,
  } = useCallWriteOptionFormModel();

  const getTermLabel = (dayCount: number) => t(dayCount === 1 ? "day" : "days").toLowerCase();

  return (
    <Card className="relative ">
      <CardContent className="space-y-5">
        <div className="flex items-center justify-between p-1 rounded-lg border">
          <p className="md:text-base text-sm font-medium text-foreground ml-2">{t("strike")}: </p>
          <div className="flex items-center">
            <p className="text-muted-foreground md:text-base text-sm md:mr-3 mr-2">
              {selectedStrikePercent}%
            </p>
            <div className="md:min-w-[190px] min-w-[150px]">
              <NumberCarousel
                values={strikeUsdValues}
                value={selectedStrikeUsd}
                onChange={handleStrikeUsdChange}
                formatValue={(value) => `$${formatUsd(value)}`}
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between border p-1 rounded-lg">
          <p className="md:text-base text-sm font-medium text-foreground ml-2  ">{t("term")}: </p>
          <div className="md:min-w-[190px] min-w-[150px]">
            <NumberCarousel
              values={termDays}
              value={selectedTermDay}
              onChange={setTerm}
              formatValue={(value) => `${value} ${getTermLabel(value)}`}
            />
          </div>
        </div>

        <BtcUsdAmountSection
          label={t("collateral")}
          amountSats={amountSats}
          btcPrice={btcPrice}
          maxAmountSats={maxCreateOfferAmountSats}
          onAmountSatsChange={handleAmountSatsChange}
        />

        <WriteEarningsSection
          onPremiumPercentChange={handlePremiumPercentChange}
          premiumPercent={premiumPercent}
          premiumValues={premiumValues}
        />

        <CallWriteOptionSummary
          amountSats={amountSats}
          competitivenessRankDisplay={competitivenessRankDisplay}
          showLargestIndicator={showLargestIndicator}
          earningsSats={earningsSats}
          strikePercent={selectedStrikePercent}
          term={selectedTermDay}
        />

        <Button
          onClick={needDepositMore ? () => setDepositModalOpen(true) : handleSubmit}
          className="w-full text-base"
          size="default"
          disabled={needDepositMore ? false : isSubmitDisabled}
        >
          {getButtonText()}
        </Button>

        <DepositModal open={depositModalOpen} onOpenChange={setDepositModalOpen} />

        <OfferResultModal
          open={showModal}
          onOpenChange={handleModalClose}
          type="create"
          step={acceptOffer.step}
          offerId={acceptOffer.data?.offerId}
          errorMessage={getNiceErrorMessage(acceptOffer.error) ?? undefined}
        />
      </CardContent>
    </Card>
  );
}
