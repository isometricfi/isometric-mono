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
import { useCallOptionBuyFormModel } from "./_internal/use-call-option-buy-form-model";
import { CallBuyOptionSummary } from "./CallBuyOptionSummary";

export function CallOptionBuyForm() {
  const [depositModalOpen, setDepositModalOpen] = useState(false);
  const t = useTranslations("Forms");
  const {
    acceptOffer,
    amountSats,
    btcPrice,
    getButtonText,
    handleModalClose,
    handleStrikeUsdChange,
    handleSubmit,
    isSubmitDisabled,
    leverage,
    maxPremiumAmountSats,
    needDepositMore,
    quantitySats,
    selectedStrikeUsd,
    selectedTermDay,
    setAmountSats,
    setTerm,
    showModal,
    strikePercent,
    strikeUsdValues,
    term,
    termDays,
  } = useCallOptionBuyFormModel();

  const getTermLabel = (dayCount: number) => t(dayCount === 1 ? "day" : "days").toLowerCase();

  return (
    <Card className="relative ">
      <CardContent className="space-y-5 ">
        <div className="flex items-center justify-between p-1 rounded-lg border">
          <p className="md:text-base text-sm font-medium text-foreground ml-2">{t("strike")}: </p>
          <div className="md:min-w-[190px] min-w-[150px]">
            <NumberCarousel
              values={strikeUsdValues}
              value={selectedStrikeUsd}
              onChange={handleStrikeUsdChange}
              formatValue={(v) => `$${formatUsd(v)}`}
            />
          </div>
        </div>
        <div className="flex items-center justify-between border p-1 rounded-lg    ">
          <p className="md:text-base text-sm font-medium text-foreground ml-2">{t("term")}: </p>
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
          label={t("premium")}
          amountSats={amountSats}
          btcPrice={btcPrice}
          maxAmountSats={maxPremiumAmountSats}
          onAmountSatsChange={setAmountSats}
        />
        <CallBuyOptionSummary
          premiumAmountSats={amountSats}
          quantitySats={quantitySats}
          leverage={leverage}
          term={term}
          strikePercent={strikePercent}
        />
        <Button
          onClick={needDepositMore ? () => setDepositModalOpen(true) : handleSubmit}
          className="w-full text-base font-semibold"
          size="lg"
          disabled={needDepositMore ? false : isSubmitDisabled}
        >
          {getButtonText()}
        </Button>

        <DepositModal open={depositModalOpen} onOpenChange={setDepositModalOpen} />

        <OfferResultModal
          open={showModal}
          onOpenChange={handleModalClose}
          type="buy"
          step={acceptOffer.step}
          fillGroupId={acceptOffer.data?.fillGroupId}
          errorMessage={getNiceErrorMessage(acceptOffer.error) ?? undefined}
        />
      </CardContent>
    </Card>
  );
}
