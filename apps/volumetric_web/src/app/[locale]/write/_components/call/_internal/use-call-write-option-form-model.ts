import { useDynamicContext } from "@dynamic-labs/sdk-react-core";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import {
  generatePremiumValues,
  useAccount,
  useConfig,
  useCreateOffer,
  useOptions,
  usePrices,
} from "@/hooks";
import {
  getSortedPositiveUniqueValues,
  getStrikeUsd,
  getStrikeUsdValues,
} from "@/lib/options-form";
import {
  DEFAULT_MAX_CREATE_OFFER_AMOUNT_SATS,
  DEFAULT_MIN_CREATE_OFFER_AMOUNT_SATS,
  formatBtc,
  formatBtcWithSymbol,
} from "@/lib/utils";
import { useChartOptionsStore } from "@/stores/chart-options-store";
import {
  getClosestPremiumPercent,
  getDefaultPremiumPercent,
  getEarningsSatsForPremiumPercent,
  getWriterCompetitiveness,
} from "./earnings-amount";

const DEFAULT_STRIKE_PERCENT = 5;
const DEFAULT_TERM_DAYS = 7;

export function useCallWriteOptionFormModel() {
  const { primaryWallet } = useDynamicContext();
  const { data: priceData } = usePrices();
  const { data: config } = useConfig();
  const { data: accountData } = useAccount();
  const { data: optionsData } = useOptions();
  const createOffer = useCreateOffer();
  const btcPrice = priceData?.btc ?? 0;
  const t = useTranslations("Forms");
  const tCommon = useTranslations("Common");

  const setChartStrikePercent = useChartOptionsStore((state) => state.setStrikePercent);
  const setChartTermDays = useChartOptionsStore((state) => state.setTermDays);

  const termDays = useMemo(
    () => getSortedPositiveUniqueValues(config?.termOptions),
    [config?.termOptions],
  );
  const strikePercentOptions = useMemo(
    () => getSortedPositiveUniqueValues(config?.strikePercentOptions),
    [config?.strikePercentOptions],
  );
  const premiumValues = useMemo(() => generatePremiumValues(config), [config]);

  const minCreateOfferAmountSats =
    config?.minCreateOfferAmountSats ?? DEFAULT_MIN_CREATE_OFFER_AMOUNT_SATS;
  const configMaxCreateOfferAmountSats =
    config?.maxCreateOfferAmountSats ?? DEFAULT_MAX_CREATE_OFFER_AMOUNT_SATS;
  const availableBalanceSats = Number(accountData?.balance?.available ?? 0);
  const maxCreateOfferAmountSats = Math.min(configMaxCreateOfferAmountSats, availableBalanceSats);

  const [term, setTermLocal] = useState(termDays[0] ?? DEFAULT_TERM_DAYS);
  const [strikePercent, setStrikePercentLocal] = useState<number>(
    strikePercentOptions[0] ?? DEFAULT_STRIKE_PERCENT,
  );
  const [premiumPercent, setPremiumPercentLocal] = useState<number>(
    getDefaultPremiumPercent(premiumValues),
  );
  const [amountSats, setAmountSats] = useState(0);

  const selectedTermDay = termDays.includes(term) ? term : (termDays[0] ?? term);
  const selectedStrikePercent = strikePercentOptions.includes(strikePercent)
    ? strikePercent
    : (strikePercentOptions[0] ?? strikePercent);

  const strikeUsdValues = useMemo(
    () => getStrikeUsdValues(strikePercentOptions, btcPrice),
    [strikePercentOptions, btcPrice],
  );
  const selectedStrikeUsd = useMemo(
    () => getStrikeUsd(btcPrice, selectedStrikePercent),
    [btcPrice, selectedStrikePercent],
  );

  const selectedStrikeOffers = useMemo(() => {
    const termGroup = optionsData?.termGroups.find((group) => group.term === selectedTermDay);
    const strikeBucket = termGroup?.strikes.find(
      (strike) => strike.strikePercent === selectedStrikePercent,
    );
    return strikeBucket?.offers ?? [];
  }, [optionsData, selectedStrikePercent, selectedTermDay]);

  const earningsSats = useMemo(
    () => getEarningsSatsForPremiumPercent(amountSats, premiumPercent),
    [amountSats, premiumPercent],
  );
  const competitiveness = useMemo(
    () => getWriterCompetitiveness(selectedStrikeOffers, premiumPercent, amountSats),
    [selectedStrikeOffers, premiumPercent, amountSats],
  );

  const isWalletConnected = !!primaryWallet;
  const needDepositMore = isWalletConnected && availableBalanceSats < minCreateOfferAmountSats;
  const isValidAmount =
    amountSats >= minCreateOfferAmountSats && amountSats <= maxCreateOfferAmountSats;

  useEffect(() => {
    if (termDays.length === 0) return;
    if (termDays.includes(term)) return;
    setTermLocal(termDays[0]);
    setChartTermDays(termDays[0]);
  }, [termDays, term, setChartTermDays]);

  useEffect(() => {
    if (strikePercentOptions.length === 0) return;
    if (strikePercentOptions.includes(strikePercent)) return;
    setStrikePercentLocal(strikePercentOptions[0]);
    setChartStrikePercent(strikePercentOptions[0]);
  }, [strikePercentOptions, strikePercent, setChartStrikePercent]);

  useEffect(() => {
    if (premiumValues.length === 0) return;
    if (premiumValues.includes(premiumPercent)) return;
    setPremiumPercentLocal(getClosestPremiumPercent(premiumPercent, premiumValues));
  }, [premiumPercent, premiumValues]);

  const setTerm = (value: number) => {
    setTermLocal(value);
    setChartTermDays(value);
  };

  const setStrikePercent = (value: number) => {
    setStrikePercentLocal(value);
    setChartStrikePercent(value);
  };

  const handleStrikeUsdChange = (usdValue: number) => {
    const index = strikeUsdValues.indexOf(usdValue);
    if (index === -1) return;
    setStrikePercent(strikePercentOptions[index] ?? selectedStrikePercent);
  };

  const handleAmountSatsChange = (nextAmountSats: number) => {
    setAmountSats(nextAmountSats);
  };

  const handlePremiumPercentChange = (nextPremiumPercent: number) => {
    setPremiumPercentLocal(nextPremiumPercent);
  };

  const handleSubmit = () => {
    createOffer.mutate({
      quantitySats: amountSats,
      strikePercent: selectedStrikePercent,
      premiumPercent,
      termDays: selectedTermDay,
    });
  };

  const handleModalClose = (open: boolean) => {
    if (open) return;

    if (createOffer.step === "success") {
      setAmountSats(0);
    }
    createOffer.reset();
  };

  const getButtonText = () => {
    if (!isWalletConnected) return t("connectWallet");
    if (needDepositMore) {
      return t("depositMoreToCreateOffers", {
        minBtc: formatBtcWithSymbol(minCreateOfferAmountSats),
      });
    }
    if (createOffer.isPending) return t("creatingOffer");
    if (amountSats < minCreateOfferAmountSats)
      return `${tCommon("min")}: ₿${formatBtc(minCreateOfferAmountSats)}`;
    if (amountSats > maxCreateOfferAmountSats)
      return `${tCommon("max")}: ₿${formatBtc(maxCreateOfferAmountSats)}`;
    return t("createOffer");
  };

  const competitivenessRankDisplay =
    competitiveness.rank === 1
      ? t("bestOffer")
      : competitiveness.totalOffers > 1
        ? `${competitiveness.rank}/${competitiveness.totalOffers}`
        : null;

  return {
    acceptOffer: createOffer,
    amountSats,
    btcPrice,
    competitiveness,
    competitivenessRankDisplay,
    earningsSats,
    getButtonText,
    handleAmountSatsChange,
    handleModalClose,
    handlePremiumPercentChange,
    handleStrikeUsdChange,
    handleSubmit,
    isSubmitDisabled: !isWalletConnected || !isValidAmount || createOffer.isPending,
    minCreateOfferAmountSats,
    maxCreateOfferAmountSats,
    needDepositMore,
    premiumPercent,
    premiumValues,
    selectedStrikePercent,
    selectedStrikeUsd,
    selectedTermDay,
    setTerm,
    showModal: createOffer.step !== "idle",
    strikeUsdValues,
    termDays,
  };
}
