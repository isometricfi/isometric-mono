import type { _SERVICE } from "@volumetric/canister-types";
import { getCreateOfferMessage } from "../canister-client.js";
import { log, withSpan } from "../telemetry.js";
import type { TRPCClient } from "../trpc-client.js";
import type { BotWallet } from "../wallet.js";

const TEN_YEARS_NS = BigInt(86400) * BigInt(1_000_000_000) * BigInt(365 * 10);

const MAX_OPEN_OFFERS = 4;
const SECONDS_PER_DAY = 86400;
const BASIS_POINTS_PER_PERCENT = 100;
const MAX_SAFE_INTEGER_BIGINT = BigInt(Number.MAX_SAFE_INTEGER);

interface FlatOffer {
  writerId: string;
  premium: number;
  strikePercent: number;
  termDays: number;
}

interface OptionsData {
  termGroups: Array<{ strikes: Array<{ offers: FlatOffer[] }> }>;
}

interface BotConfigData {
  termOptions: number[];
  strikePercentOptions: number[];
  premium: {
    min: number;
    max: number;
    step: number;
  };
  minOfferAmountSats: number;
  maxOfferAmountSats: number;
}

interface OfferParams {
  quantitySats: number;
  strikeBasisPoints: number;
  premiumBasisPoints: number;
  optionDurationSeconds: number;
  termDays: number;
}

interface AccountBalance {
  available: bigint;
}

interface AccountProfile {
  principal: string;
}

interface AccountData {
  profile: AccountProfile | null;
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomStep(min: number, max: number, step: number): number {
  const steps = Math.floor((max - min) / step);
  const randomStepIndex = randomInt(0, steps);
  return min + randomStepIndex * step;
}

function randomFromArray<T>(values: T[]): T {
  const randomIndex = randomInt(0, values.length - 1);
  return values[randomIndex];
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

function isOfferOwnedByBot(
  offer: FlatOffer,
  walletAddress: string,
  ownPrincipal: string | null,
): boolean {
  if (ownPrincipal && offer.writerId === ownPrincipal) {
    return true;
  }
  return offer.writerId === walletAddress;
}

function countOwnOpenOffers(
  optionsData: OptionsData,
  walletAddress: string,
  ownPrincipal: string | null,
): number {
  const allOffers = flattenOffers(optionsData);
  return allOffers.filter((offer) => isOfferOwnedByBot(offer, walletAddress, ownPrincipal)).length;
}

function toBasisPoints(percent: number): number {
  return Math.round(percent * BASIS_POINTS_PER_PERCENT);
}

function bigintToSafeNumber(value: bigint): number {
  if (value > MAX_SAFE_INTEGER_BIGINT) {
    return Number.MAX_SAFE_INTEGER;
  }
  return Number(value);
}

function getAvailableSats(balance: AccountBalance | null | undefined): number {
  if (!balance) {
    return 0;
  }
  return bigintToSafeNumber(balance.available);
}

function buildOfferParams(
  config: BotConfigData,
  optionsData: OptionsData,
  maxAffordableSats: number,
): OfferParams | null {
  if (config.termOptions.length === 0 || config.strikePercentOptions.length === 0) {
    return null;
  }

  if (maxAffordableSats < config.minOfferAmountSats) {
    return null;
  }

  const termDays = randomFromArray(config.termOptions);
  const strikePercent = randomFromArray(config.strikePercentOptions);

  const minPremiumBps = toBasisPoints(config.premium.min);
  const maxPremiumBps = toBasisPoints(config.premium.max);
  const premiumStepBps = Math.max(toBasisPoints(config.premium.step), 1);

  const marketPremiumsBps = flattenOffers(optionsData)
    .filter((offer) => offer.termDays === termDays && offer.strikePercent === strikePercent)
    .map((offer) => toBasisPoints(offer.premium));

  const premiumBasisPoints =
    marketPremiumsBps.length > 0
      ? randomFromArray(marketPremiumsBps)
      : randomStep(minPremiumBps, maxPremiumBps, premiumStepBps);

  const clampedPremiumBasisPoints = Math.min(
    Math.max(premiumBasisPoints, minPremiumBps),
    maxPremiumBps,
  );

  const quantityUpperBound = Math.min(config.maxOfferAmountSats, maxAffordableSats);
  const quantitySats = randomInt(config.minOfferAmountSats, quantityUpperBound);
  const strikeBasisPoints = toBasisPoints(strikePercent);
  const optionDurationSeconds = termDays * SECONDS_PER_DAY;

  return {
    quantitySats,
    strikeBasisPoints,
    premiumBasisPoints: clampedPremiumBasisPoints,
    optionDurationSeconds,
    termDays,
  };
}

export async function createOffer(
  actor: _SERVICE,
  trpc: TRPCClient,
  wallet: BotWallet,
): Promise<void> {
  await withSpan(
    "bot.create_offer",
    {
      address: wallet.address,
    },
    async (span) => {
      const [optionsData, account] = await Promise.all([
        trpc.options.listOptions.query(),
        trpc.account.getAccount.query({ address: wallet.address }),
      ]);
      const ownPrincipal = (account as AccountData | null)?.profile?.principal ?? null;
      const ownOpenOffers = countOwnOpenOffers(optionsData, wallet.address, ownPrincipal);

      if (ownOpenOffers >= MAX_OPEN_OFFERS) {
        log("info", "Skipping offer creation, max open offers reached", {
          own_open_offers: ownOpenOffers,
          max_open_offers: MAX_OPEN_OFFERS,
        });
        span.setAttribute("skipped", true);
        span.setAttribute("skip_reason", "max_open_offers_reached");
        span.setAttribute("own_open_offers", ownOpenOffers);
        span.setAttribute("max_open_offers", MAX_OPEN_OFFERS);
        return;
      }

      const config = await trpc.config.getConfig.query();
      const minRequiredForOffer = config.minOfferAmountSats;

      const balance = await trpc.account.getBalance.query({
        address: wallet.address,
      });

      let availableSats = getAvailableSats(balance as AccountBalance | null);

      if (availableSats < minRequiredForOffer) {
        log("info", "Balance too low, syncing ckBTC balance", {
          available: availableSats,
          required: minRequiredForOffer,
        });

        await trpc.account.syncBalance.mutate({
          address: wallet.address,
        });

        const syncedBalance = await trpc.account.getBalance.query({
          address: wallet.address,
        });

        availableSats = getAvailableSats(syncedBalance as AccountBalance | null);

        if (availableSats < minRequiredForOffer) {
          const depositInfo = await trpc.account.getDepositAddress.query({
            address: wallet.address,
          });

          log("warn", "Insufficient balance to create offer, deposit required", {
            available: availableSats,
            required: minRequiredForOffer,
            deposit_address: depositInfo.btcAddress,
          });

          span.setAttribute("skipped", true);
          span.setAttribute("skip_reason", "insufficient_balance");
          span.setAttribute("deposit_address", depositInfo.btcAddress);
          return;
        }

        log("info", "Balance sync succeeded, proceeding with offer creation", {
          available: availableSats,
          required: minRequiredForOffer,
        });
      }

      const params = buildOfferParams(config, optionsData, availableSats);
      if (!params) {
        log("warn", "Unable to build a valid offer with current constraints", {
          available: availableSats,
          min_offer_amount_sats: config.minOfferAmountSats,
          max_offer_amount_sats: config.maxOfferAmountSats,
        });
        span.setAttribute("skipped", true);
        span.setAttribute("skip_reason", "invalid_offer_constraints");
        return;
      }

      log("info", "Creating offer", {
        quantity_sats: params.quantitySats,
        strike_bps: params.strikeBasisPoints,
        premium_bps: params.premiumBasisPoints,
        term_days: params.termDays,
        own_open_offers: ownOpenOffers,
      });

      const message = await getCreateOfferMessage(
        actor,
        wallet.address,
        BigInt(params.quantitySats),
        params.strikeBasisPoints,
        params.premiumBasisPoints,
      );

      const signature = wallet.signMessage(message);

      const now = BigInt(Date.now()) * BigInt(1_000_000);
      const offerValidUntil = now + TEN_YEARS_NS;

      const result = await trpc.options.createOffer.mutate({
        address: wallet.address,
        signature,
        quantity: params.quantitySats.toString(),
        strikeBasisPoints: params.strikeBasisPoints,
        premiumBasisPoints: params.premiumBasisPoints,
        offerValidUntil: offerValidUntil.toString(),
        optionDurationSeconds: params.optionDurationSeconds.toString(),
      });

      log("info", "Offer created", {
        offer_id: result.offerId,
        quantity_sats: params.quantitySats,
        strike_bps: params.strikeBasisPoints,
        premium_bps: params.premiumBasisPoints,
      });

      span.setAttribute("offer_id", result.offerId);
    },
  );
}
