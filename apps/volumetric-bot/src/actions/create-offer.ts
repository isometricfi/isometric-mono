import type { _SERVICE } from "@volumetric/canister-types";
import { getCreateOfferMessage } from "../canister-client.js";
import { log, withSpan } from "../telemetry.js";
import type { TRPCClient } from "../trpc-client.js";
import type { BotWallet } from "../wallet.js";

const TEN_YEARS_NS = BigInt(86400) * BigInt(1_000_000_000) * BigInt(365 * 10);

interface TradingLimits {
  minQuantitySats: number;
  maxQuantitySats: number;
  minStrikeBps: number;
  maxStrikeBps: number;
  strikeBpsStep: number;
  minPremiumBps: number;
  maxPremiumBps: number;
  premiumBpsStep: number;
  minDurationDays: number;
  maxDurationDays: number;
}

const DEFAULT_LIMITS: TradingLimits = {
  minQuantitySats: 90_000,
  maxQuantitySats: 10_000_000,
  minStrikeBps: 500,
  maxStrikeBps: 10_000,
  strikeBpsStep: 500,
  minPremiumBps: 50,
  maxPremiumBps: 10_000,
  premiumBpsStep: 50,
  minDurationDays: 1,
  maxDurationDays: 30,
};

const SECONDS_PER_DAY = 86400;

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomStep(min: number, max: number, step: number): number {
  const steps = Math.floor((max - min) / step);
  const randomStepIndex = randomInt(0, steps);
  return min + randomStepIndex * step;
}

function generateRandomParams(limits: TradingLimits) {
  const quantitySats = randomInt(limits.minQuantitySats, limits.maxQuantitySats);
  const strikeBasisPoints = randomStep(
    limits.minStrikeBps,
    limits.maxStrikeBps,
    limits.strikeBpsStep,
  );
  const premiumBasisPoints = randomStep(
    limits.minPremiumBps,
    limits.maxPremiumBps,
    limits.premiumBpsStep,
  );
  const termDays = randomInt(limits.minDurationDays, limits.maxDurationDays);
  const optionDurationSeconds = termDays * SECONDS_PER_DAY;

  return { quantitySats, strikeBasisPoints, premiumBasisPoints, optionDurationSeconds, termDays };
}

export async function createOffer(
  actor: _SERVICE,
  trpc: TRPCClient,
  wallet: BotWallet,
): Promise<void> {
  const params = generateRandomParams(DEFAULT_LIMITS);

  await withSpan(
    "bot.create_offer",
    {
      address: wallet.address,
      quantity_sats: params.quantitySats,
      strike_bps: params.strikeBasisPoints,
      premium_bps: params.premiumBasisPoints,
      term_days: params.termDays,
    },
    async (span) => {
      log("info", "Creating offer", {
        quantity_sats: params.quantitySats,
        strike_bps: params.strikeBasisPoints,
        premium_bps: params.premiumBasisPoints,
        term_days: params.termDays,
      });

      const balance = await trpc.account.getBalance.query({
        address: wallet.address,
      });

      if (!balance || balance.available < BigInt(params.quantitySats)) {
        log("warn", "Insufficient balance to create offer", {
          available: balance?.available.toString() ?? "0",
          required: params.quantitySats,
        });
        span.setAttribute("skipped", true);
        span.setAttribute("skip_reason", "insufficient_balance");
        return;
      }

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
