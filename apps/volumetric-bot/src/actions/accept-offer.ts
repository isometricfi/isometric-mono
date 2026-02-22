import type { _SERVICE } from "@volumetric/canister-types";
import { getAcceptOffersMessage } from "../canister-client.js";
import { log, withSpan } from "../telemetry.js";
import type { TRPCClient } from "../trpc-client.js";
import type { BotWallet } from "../wallet.js";

const TRANSFER_FEE_BUFFER_SATS = 20;

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

function flattenOffers(optionsData: OptionsData): FlatOffer[] {
  const offers: FlatOffer[] = [];
  for (const termGroup of optionsData.termGroups) {
    for (const strike of termGroup.strikes) {
      for (const offer of strike.offers) {
        offers.push(offer);
      }
    }
  }
  return offers;
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

export async function acceptOffer(
  actor: _SERVICE,
  trpc: TRPCClient,
  wallet: BotWallet,
): Promise<void> {
  await withSpan("bot.accept_offer", { address: wallet.address }, async (span) => {
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
      span.setAttribute("skip_reason", "no_offers");
      return;
    }

    const ownPrincipal = (account as AccountData | null)?.profile?.principal ?? null;

    // Filter out own offers (canister blocks self-trade, but we avoid the error preflight)
    const otherOffers = allOffers.filter(
      (offer) => !isOwnOffer(offer, wallet.address, ownPrincipal),
    );

    if (otherOffers.length === 0) {
      log("info", "No offers from other writers available");
      span.setAttribute("skipped", true);
      span.setAttribute("skip_reason", "only_own_offers");
      return;
    }

    const minimumOfferAmountSats = (config as ConfigData).minOfferAmountSats;
    const validOffers = getMinimumQuantityOffers(otherOffers, minimumOfferAmountSats);

    if (validOffers.length === 0) {
      log("info", "No valid offers above minimum quantity", {
        minimum_quantity_sats: minimumOfferAmountSats,
      });
      span.setAttribute("skipped", true);
      span.setAttribute("skip_reason", "no_valid_offers");
      span.setAttribute("minimum_quantity_sats", minimumOfferAmountSats);
      return;
    }

    // Pick a random offer
    const randomIndex = Math.floor(Math.random() * validOffers.length);
    const selectedOffer = validOffers[randomIndex];

    log("info", "Selected offer to accept", {
      offer_id: selectedOffer.id,
      amount_sats: selectedOffer.amountSats,
      premium: selectedOffer.premium,
      strike_percent: selectedOffer.strikePercent,
    });

    // Check buyer balance (premium + transfer fees)
    const balance = await trpc.account.getBalance.query({
      address: wallet.address,
    });

    const premiumSats = Math.ceil(selectedOffer.amountSats * (selectedOffer.premium / 100));
    const estimatedCost = premiumSats + TRANSFER_FEE_BUFFER_SATS;

    if (!balance || balance.available < BigInt(estimatedCost)) {
      log("warn", "Insufficient balance to accept offer", {
        available: balance?.available.toString() ?? "0",
        estimated_cost: estimatedCost,
      });
      span.setAttribute("skipped", true);
      span.setAttribute("skip_reason", "insufficient_balance");
      return;
    }

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
  });
}
