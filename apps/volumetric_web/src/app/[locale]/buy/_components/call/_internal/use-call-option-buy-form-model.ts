import { useDynamicContext } from "@dynamic-labs/sdk-react-core";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import {
  getStrikePercentsForTerm,
  useAcceptOffer,
  useAccount,
  useConfig,
  useOptions,
  usePrices,
} from "@/hooks";
import {
  getSortedPositiveUniqueValues,
  getStrikeUsd,
  getStrikeUsdValues,
} from "@/lib/options-form";
import { DEFAULT_MIN_OFFER_AMOUNT_SATS, formatBtc } from "@/lib/utils";
import { useChartOptionsStore } from "@/stores/chart-options-store";
import {
  findBestOfferForPremiumAmount,
  getMaxPremiumAmountSats,
  getMinPremiumAmountSats,
} from "./premium-amount";

const DEFAULT_STRIKE_PERCENT = 5;

export function useCallOptionBuyFormModel() {
  const { primaryWallet } = useDynamicContext();
  const { data } = useOptions();
  const { data: account } = useAccount();
  const { data: priceData } = usePrices();
  const { data: config } = useConfig();
  const acceptOffer = useAcceptOffer();
  const btcPrice = priceData?.btc ?? 0;
  const t = useTranslations("Forms");
  const tCommon = useTranslations("Common");

  const term = useChartOptionsStore((state) => state.termDays);
  const setChartStrikePercent = useChartOptionsStore((state) => state.setStrikePercent);
  const setChartTermDays = useChartOptionsStore((state) => state.setTermDays);

  const minOfferAmountSats = config?.minOfferAmountSats ?? DEFAULT_MIN_OFFER_AMOUNT_SATS;
  const [amountSats, setAmountSats] = useState(0);
  const [strikePercent, setStrikePercentLocal] = useState<number>(DEFAULT_STRIKE_PERCENT);

  const termDays = useMemo(
    () => getSortedPositiveUniqueValues(config?.termOptions),
    [config?.termOptions],
  );
  const selectedTermDay = termDays.includes(term) ? term : (termDays[0] ?? term);

  const filteredData = useMemo(() => {
    if (!data) return undefined;
    if (!account?.profile?.principal) return data;

    const userPrincipal = account.profile.principal;

    return {
      ...data,
      termGroups: data.termGroups
        .map((group) => ({
          ...group,
          strikes: group.strikes
            .map((strike) => ({
              ...strike,
              offers: strike.offers.filter((offer) => offer.writerId !== userPrincipal),
            }))
            .filter((strike) => strike.offers.length > 0),
        }))
        .filter((group) => group.strikes.length > 0),
    };
  }, [data, account]);

  const strikePercents = useMemo(
    () => getStrikePercentsForTerm(filteredData, term),
    [filteredData, term],
  );
  const strikeUsdValues = useMemo(
    () => getStrikeUsdValues(strikePercents, btcPrice),
    [strikePercents, btcPrice],
  );

  const selectedStrikeOffers = useMemo(() => {
    const termGroup = filteredData?.termGroups.find((group) => group.term === term);
    const strikeBucket = termGroup?.strikes.find(
      (strike) => strike.strikePercent === strikePercent,
    );
    return strikeBucket?.offers ?? [];
  }, [filteredData, term, strikePercent]);

  const maxPremiumAmountSats = useMemo(
    () => getMaxPremiumAmountSats(selectedStrikeOffers),
    [selectedStrikeOffers],
  );
  const minPremiumAmountSats = useMemo(
    () => getMinPremiumAmountSats(selectedStrikeOffers, minOfferAmountSats),
    [selectedStrikeOffers, minOfferAmountSats],
  );

  const offerMatch = useMemo(
    () => findBestOfferForPremiumAmount(selectedStrikeOffers, amountSats, minOfferAmountSats),
    [selectedStrikeOffers, amountSats, minOfferAmountSats],
  );
  const bestOffer = offerMatch?.offer ?? null;
  const quantitySats = offerMatch?.quantitySats ?? 0;

  const selectedStrikeUsd = useMemo(
    () => getStrikeUsd(btcPrice, strikePercent),
    [btcPrice, strikePercent],
  );

  useEffect(() => {
    if (termDays.length === 0) return;
    if (termDays.includes(term)) return;
    setChartTermDays(termDays[0]);
  }, [termDays, term, setChartTermDays]);

  useEffect(() => {
    if (strikePercents.length === 0) return;
    if (strikePercents.includes(strikePercent)) return;

    const nextStrikePercent = strikePercents[0];
    setStrikePercentLocal(nextStrikePercent);
    setChartStrikePercent(nextStrikePercent);
  }, [strikePercents, strikePercent, setChartStrikePercent]);

  useEffect(() => {
    if (maxPremiumAmountSats <= 0) {
      setAmountSats(0);
      return;
    }

    const defaultAmountSats = Math.floor(maxPremiumAmountSats / 2);
    if (defaultAmountSats <= 0) {
      setAmountSats(0);
      return;
    }

    setAmountSats(defaultAmountSats);
  }, [maxPremiumAmountSats]);

  const setTerm = (value: number) => {
    setChartTermDays(value);
  };

  const setStrikePercent = (value: number) => {
    setStrikePercentLocal(value);
    setChartStrikePercent(value);
  };

  const handleStrikeUsdChange = (usdValue: number) => {
    const index = strikeUsdValues.indexOf(usdValue);
    if (index === -1) return;
    setStrikePercent(strikePercents[index]);
  };

  const handleSubmit = () => {
    if (!bestOffer) return;
    acceptOffer.mutate({
      offerId: bestOffer.id,
      quantitySats,
    });
  };

  const handleModalClose = (open: boolean) => {
    if (open) return;

    if (acceptOffer.step === "success") {
      setAmountSats(0);
    }
    acceptOffer.reset();
  };

  const isWalletConnected = !!primaryWallet;
  const hasInsufficientLiquidity = amountSats > maxPremiumAmountSats && maxPremiumAmountSats > 0;
  const isBelowMinimum = amountSats > 0 && amountSats < minPremiumAmountSats;
  const isValidAmount =
    amountSats > 0 && !isBelowMinimum && !hasInsufficientLiquidity && bestOffer !== null;
  const leverage = amountSats > 0 && quantitySats > 0 ? quantitySats / amountSats : 0;

  const getButtonText = () => {
    if (!isWalletConnected) return t("connectWallet");
    if (acceptOffer.isPending) return t("buyingOption");
    if (hasInsufficientLiquidity) return t("insufficientLiquidity");
    if (isBelowMinimum) return `${tCommon("min")}: ₿${formatBtc(minPremiumAmountSats)}`;
    if (!bestOffer && amountSats > 0) return t("noOffersAvailable");
    return t("buyOption");
  };

  return {
    acceptOffer,
    amountSats,
    btcPrice,
    getButtonText,
    handleModalClose,
    handleStrikeUsdChange,
    handleSubmit,
    isSubmitDisabled: !isWalletConnected || !isValidAmount || !bestOffer || acceptOffer.isPending,
    leverage,
    maxPremiumAmountSats,
    quantitySats,
    selectedStrikeUsd,
    selectedTermDay,
    setAmountSats,
    setTerm,
    showModal: acceptOffer.step !== "idle",
    strikePercent,
    strikeUsdValues,
    term,
    termDays,
  };
}
