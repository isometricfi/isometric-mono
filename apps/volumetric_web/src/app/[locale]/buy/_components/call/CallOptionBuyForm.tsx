"use client";

import { useTranslations } from "next-intl";
import { OfferResultModal } from "@/components/options/OfferResultModal";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { NumberCarousel } from "@/components/ui/number-carousel";
import { useCallOptionBuyFormModel } from "./_internal/use-call-option-buy-form-model";
import { BuyPremiumAmountSection } from "./BuyPremiumAmountSection";
import { CallBuyOptionSummary } from "./CallBuyOptionSummary";

export function CallOptionBuyForm() {
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

  return (
    <Card className="relative">
      <CardContent className="h-fit  space-y-5  pt-9">
        <div className="flex items-center gap-2 font-semibold bg-muted px-2 py-2 rounded-b-xl w-fit absolute top-0 left-1/2 -translate-x-1/2">
          <img
            src="https://cdn.freebiesupply.com/logos/large/2x/bitcoin-logo-png-transparent.png"
            alt={t("bitcoin")}
            className="size-6"
          />
          {t("bitcoin")}
        </div>
        <div className="flex items-center justify-between p-1 rounded-lg border">
          <p className="text-base font-medium text-foreground ml-2">{t("willBeAbove")}: </p>
          <div className="min-w-[200px]">
            <NumberCarousel
              values={strikeUsdValues}
              value={selectedStrikeUsd}
              onChange={handleStrikeUsdChange}
              formatValue={(v) => `$${v.toLocaleString()}`}
            />
          </div>
          {/* <span className="text-sm text-muted-foreground">{strikePercent}%</span> */}
        </div>
        <div className="flex items-center justify-between border p-1 rounded-lg    ">
          <p className="text-base font-medium text-foreground ml-2">{t("inLabel")}: </p>

          <div className="min-w-[200px]">
            <NumberCarousel
              values={termDays}
              value={selectedTermDay}
              onChange={setTerm}
              formatValue={(value) => `${value} ${t("days").toLowerCase()}`}
            />
          </div>
        </div>
        <BuyPremiumAmountSection
          amountSats={amountSats}
          maxPremiumAmountSats={maxPremiumAmountSats}
          btcPrice={btcPrice}
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
          onClick={handleSubmit}
          className="w-full  text-base font-semibold"
          size="lg"
          disabled={isSubmitDisabled}
        >
          {getButtonText()}
        </Button>

        <OfferResultModal
          open={showModal}
          onOpenChange={handleModalClose}
          type="buy"
          step={acceptOffer.step}
          fillGroupId={acceptOffer.data?.fillGroupId}
          errorMessage={acceptOffer.error?.message}
        />
      </CardContent>
    </Card>
  );
}
