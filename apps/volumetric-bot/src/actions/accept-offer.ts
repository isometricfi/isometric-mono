import type { _SERVICE } from "@volumetric/canister-types";
import { getAcceptOffersMessage } from "../canister-client.js";
import { log, withSpan } from "../telemetry.js";
import type { TRPCClient } from "../trpc-client.js";
import type { BotWallet } from "../wallet.js";

interface FlatOffer {
  id: string;
  writerId: string;
  amountSats: number;
  premium: number;
  strikePercent: number;
  termDays: number;
}

function flattenOffers(optionsData: {
  termGroups: Array<{ strikes: Array<{ offers: FlatOffer[] }> }>;
}): FlatOffer[] {
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

export async function acceptOffer(
  actor: _SERVICE,
  trpc: TRPCClient,
  wallet: BotWallet,
): Promise<void> {
  await withSpan("bot.accept_offer", { address: wallet.address }, async (span) => {
    log("info", "Fetching open offers");

    const optionsData = await trpc.options.listOptions.query();
    const allOffers = flattenOffers(optionsData);

    if (allOffers.length === 0) {
      log("info", "No open offers available");
      span.setAttribute("skipped", true);
      span.setAttribute("skip_reason", "no_offers");
      return;
    }

    // Filter out own offers (the canister blocks self-trade, but we avoid the error)
    const otherOffers = allOffers.filter((offer) => offer.writerId !== wallet.address);

    if (otherOffers.length === 0) {
      log("info", "No offers from other writers available");
      span.setAttribute("skipped", true);
      span.setAttribute("skip_reason", "only_own_offers");
      return;
    }

    // Pick a random offer
    const randomIndex = Math.floor(Math.random() * otherOffers.length);
    const selectedOffer = otherOffers[randomIndex];

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
    const estimatedCost = premiumSats + 20; // buffer for transfer fees

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
