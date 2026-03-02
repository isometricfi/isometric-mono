import type { _SERVICE } from "@volumetric/canister-types";
import { getAcceptOffersMessage } from "../canister-client.js";
import { log, withSpan } from "../telemetry.js";
import type { TRPCClient } from "../trpc-client.js";
import type { BotWallet } from "../wallet.js";

const MAX_OPTION_TERM_DAYS = 3;

export const ACCEPT_OFFER_OUTCOME = {
  accepted: "accepted",
  noOffers: "no_offers",
  onlyOwnOffers: "only_own_offers",
  noShortTermOffers: "no_short_term_offers",
  noValidOffers: "no_valid_offers",
} as const;

const ACCEPT_OFFER_SKIP_REASON = {
  noOffers: "no_offers",
  onlyOwnOffers: "only_own_offers",
  noShortTermOffers: "no_short_term_offers",
  noValidOffers: "no_valid_offers",
} as const;

interface FlatOffer {
  id: string;
  writerId: string;
  amountSats: number;
  premium: number;
  strikePercent: number;
  termDays: number;
}

interface OptionsData {
  termGroups: Array<{ strikes: Array<{ offers: FlatOffer[] }> }>;
}

interface ConfigData {
  minOfferAmountSats: number;
}

interface AccountData {
  profile: {
    principal: string;
  } | null;
}

type AcceptOfferOutcome = (typeof ACCEPT_OFFER_OUTCOME)[keyof typeof ACCEPT_OFFER_OUTCOME];

export interface AcceptOfferResult {
  outcome: AcceptOfferOutcome;
  selectedOfferId?: string;
  selectedOfferScore?: number;
  candidateCount?: number;
}

function flattenOffers(optionsData: OptionsData): FlatOffer[] {
  return optionsData.termGroups.flatMap((termGroup) =>
    termGroup.strikes.flatMap((strike) => strike.offers),
  );
}

function isOwnOffer(offer: FlatOffer, walletAddress: string, ownPrincipal: string | null): boolean {
  if (ownPrincipal && offer.writerId === ownPrincipal) {
    return true;
  }
  return offer.writerId === walletAddress;
}

function getMinimumQuantityOffers(offers: FlatOffer[], minOfferAmountSats: number): FlatOffer[] {
  return offers.filter((offer) => offer.amountSats >= minOfferAmountSats);
}

function getShortTermOffers(offers: FlatOffer[]): FlatOffer[] {
  return offers.filter((offer) => offer.termDays <= MAX_OPTION_TERM_DAYS);
}

function getOfferScore(offer: FlatOffer): number {
  return offer.strikePercent - offer.premium;
}

function parseOfferId(offerId: string): number {
  const parsed = Number.parseInt(offerId, 10);
  if (Number.isNaN(parsed)) {
    return Number.MAX_SAFE_INTEGER;
  }
  return parsed;
}

function compareOffers(a: FlatOffer, b: FlatOffer): number {
  const scoreDiff = getOfferScore(b) - getOfferScore(a);
  if (scoreDiff !== 0) {
    return scoreDiff;
  }

  const premiumDiff = a.premium - b.premium;
  if (premiumDiff !== 0) {
    return premiumDiff;
  }

  const amountDiff = b.amountSats - a.amountSats;
  if (amountDiff !== 0) {
    return amountDiff;
  }

  return parseOfferId(a.id) - parseOfferId(b.id);
}

export async function acceptOffer(
  actor: _SERVICE,
  trpc: TRPCClient,
  wallet: BotWallet,
): Promise<AcceptOfferResult> {
  return withSpan("bot.accept_offer", { address: wallet.address }, async (span) => {
    log("info", "Fetching open offers");

    const [optionsData, config, account] = await Promise.all([
      trpc.options.listOptions.query(),
      trpc.config.getConfig.query(),
      trpc.account.getAccount.query({ address: wallet.address }),
    ]);
    const allOffers = flattenOffers(optionsData as OptionsData);

    if (allOffers.length === 0) {
      log("info", "No open offers available");
      span.setAttribute("skipped", true);
      span.setAttribute("skip_reason", ACCEPT_OFFER_SKIP_REASON.noOffers);
      return {
        outcome: ACCEPT_OFFER_OUTCOME.noOffers,
      } as const;
    }

    const ownPrincipal = (account as AccountData | null)?.profile?.principal ?? null;

    // Filter out own offers (canister blocks self-trade, but we avoid the error preflight)
    const otherOffers = allOffers.filter(
      (offer) => !isOwnOffer(offer, wallet.address, ownPrincipal),
    );

    if (otherOffers.length === 0) {
      log("info", "No offers from other writers available");
      span.setAttribute("skipped", true);
      span.setAttribute("skip_reason", ACCEPT_OFFER_SKIP_REASON.onlyOwnOffers);
      return {
        outcome: ACCEPT_OFFER_OUTCOME.onlyOwnOffers,
      } as const;
    }

    const shortTermOffers = getShortTermOffers(otherOffers);
    if (shortTermOffers.length === 0) {
      log("info", "No short-term offers available", {
        max_term_days: MAX_OPTION_TERM_DAYS,
      });
      span.setAttribute("skipped", true);
      span.setAttribute("skip_reason", ACCEPT_OFFER_SKIP_REASON.noShortTermOffers);
      span.setAttribute("max_term_days", MAX_OPTION_TERM_DAYS);
      return {
        outcome: ACCEPT_OFFER_OUTCOME.noShortTermOffers,
      } as const;
    }

    const minimumOfferAmountSats = (config as ConfigData).minOfferAmountSats;
    const validOffers = getMinimumQuantityOffers(shortTermOffers, minimumOfferAmountSats);

    if (validOffers.length === 0) {
      log("info", "No valid offers above minimum quantity", {
        minimum_quantity_sats: minimumOfferAmountSats,
      });
      span.setAttribute("skipped", true);
      span.setAttribute("skip_reason", ACCEPT_OFFER_SKIP_REASON.noValidOffers);
      span.setAttribute("minimum_quantity_sats", minimumOfferAmountSats);
      return {
        outcome: ACCEPT_OFFER_OUTCOME.noValidOffers,
      } as const;
    }

    const rankedOffers = [...validOffers].sort(compareOffers);
    const selectedOffer = rankedOffers[0];
    const selectedOfferScore = getOfferScore(selectedOffer);
    span.setAttribute("candidate_count", rankedOffers.length);
    span.setAttribute("selected_offer_id", selectedOffer.id);
    span.setAttribute("selected_offer_score", selectedOfferScore);

    log("info", "Selected offer to accept", {
      offer_id: selectedOffer.id,
      amount_sats: selectedOffer.amountSats,
      premium: selectedOffer.premium,
      strike_percent: selectedOffer.strikePercent,
    });

    const items = [
      {
        offer_id: BigInt(selectedOffer.id),
        quantity: BigInt(selectedOffer.amountSats),
      },
    ];

    const message = await getAcceptOffersMessage(actor, wallet.address, items);
    const signature = wallet.signMessage(message);

    const result = await trpc.options.acceptOffers.mutate({
      address: wallet.address,
      signature,
      items: [
        {
          offerId: selectedOffer.id,
          quantity: selectedOffer.amountSats.toString(),
        },
      ],
    });

    log("info", "Offer accepted", {
      fill_group_id: result.fillGroupId,
      active_option_ids: result.activeOptionIds.join(", "),
      offer_id: selectedOffer.id,
    });

    span.setAttribute("fill_group_id", result.fillGroupId);
    span.setAttribute("offer_id", selectedOffer.id);
    return {
      outcome: ACCEPT_OFFER_OUTCOME.accepted,
      selectedOfferId: selectedOffer.id,
      selectedOfferScore,
      candidateCount: rankedOffers.length,
    } as const;
  });
}
