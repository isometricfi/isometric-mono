"use client";

import { useTranslations } from "next-intl";
import { BtcUsdAmountSection } from "@/components/options/BtcUsdAmountSection";
import { OfferResultModal } from "@/components/options/OfferResultModal";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { NumberCarousel } from "@/components/ui/number-carousel";
import { useCallWriteOptionFormModel } from "./_internal/use-call-write-option-form-model";
import { CallWriteOptionSummary } from "./CallWriteOptionSummary";
import { WriteEarningsSection } from "./WriteEarningsSection";

export function CallWriteOptionForm() {
  const t = useTranslations("Forms");
  const {
    acceptOffer,
    amountSats,
    btcPrice,
    competitivenessRankDisplay,
    earningsSats,
    getButtonText,
    handleAmountSatsChange,
    handleModalClose,
    handlePremiumPercentChange,
    handleStrikeUsdChange,
    handleSubmit,
    isSubmitDisabled,
    maxOfferAmountSats,
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

  return (
    <Card className="relative ">
      <CardContent className="space-y-5">
        <div className="flex items-center justify-between p-1 rounded-lg border">
          <p className="md:text-base text-sm font-medium text-foreground ml-2">
            {t("willBeAbove")}:{" "}
          </p>
          <div className="md:min-w-[190px] min-w-[150px]">
            <NumberCarousel
              values={strikeUsdValues}
              value={selectedStrikeUsd}
              onChange={handleStrikeUsdChange}
              formatValue={(value) => `$${value.toLocaleString()}`}
            />
          </div>
        </div>

        <div className="flex items-center justify-between border p-1 rounded-lg">
          <p className="md:text-base text-sm font-medium text-foreground ml-2  ">
            {t("inLabel")}:{" "}
          </p>
          <div className="md:min-w-[190px] min-w-[150px]">
            <NumberCarousel
              values={termDays}
              value={selectedTermDay}
              onChange={setTerm}
              formatValue={(value) => `${value} ${t("days").toLowerCase()}`}
            />
          </div>
        </div>

        <BtcUsdAmountSection
          label={t("collateral")}
          amountSats={amountSats}
          btcPrice={btcPrice}
          maxAmountSats={maxOfferAmountSats}
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
          earningsSats={earningsSats}
          strikePercent={selectedStrikePercent}
          term={selectedTermDay}
        />

        <Button
          onClick={handleSubmit}
          className="w-full text-base "
          size="default"
          disabled={isSubmitDisabled}
        >
          {getButtonText()}
        </Button>

        <OfferResultModal
          open={showModal}
          onOpenChange={handleModalClose}
          type="create"
          step={acceptOffer.step}
          offerId={acceptOffer.data?.offerId}
          errorMessage={acceptOffer.error?.message}
        />
      </CardContent>
    </Card>
  );
}
