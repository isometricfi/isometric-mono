import { z } from "zod";
import { CHALLENGE_MAX_LIFETIME_SECONDS, walletProofInputSchema } from "../../_shared/wallet-proof";
import { offerValidUntilAcceptableRange } from "./offer-valid-until-policy";

const NUMERIC_STRING = /^\d+$/;
const MIN_OFFER_QUANTITY_SATS = 40_000n;
const MAX_OFFER_QUANTITY_SATS = 100_000_000n;
const MIN_STRIKE_BASIS_POINTS = 100;
const MAX_STRIKE_BASIS_POINTS = 800;
const MIN_PREMIUM_BASIS_POINTS = 10;
const MAX_PREMIUM_BASIS_POINTS = 300;
const SECONDS_PER_DAY = 86_400n;
const MIN_OPTION_DURATION_SECONDS = 3n * SECONDS_PER_DAY;
const MAX_OPTION_DURATION_SECONDS = 7n * SECONDS_PER_DAY;

export const inputSchema = walletProofInputSchema
  .extend({
    quantity: numericStringWithinRange(
      MIN_OFFER_QUANTITY_SATS,
      MAX_OFFER_QUANTITY_SATS,
      "quantity is outside the demo trading limits",
    ),
    strikeBasisPoints: z.number().int().min(MIN_STRIKE_BASIS_POINTS).max(MAX_STRIKE_BASIS_POINTS),
    premiumBasisPoints: z
      .number()
      .int()
      .min(MIN_PREMIUM_BASIS_POINTS)
      .max(MAX_PREMIUM_BASIS_POINTS),
    offerValidUntilSeconds: z
      .string()
      .regex(NUMERIC_STRING, "offerValidUntilSeconds must be a numeric string"),
    optionDurationSeconds: numericStringWithinRange(
      MIN_OPTION_DURATION_SECONDS,
      MAX_OPTION_DURATION_SECONDS,
      "optionDurationSeconds is outside the demo trading limits",
    ),
  })
  .superRefine((data, ctx) => {
    const nowSeconds = BigInt(Math.floor(Date.now() / 1000));

    let offerUntil: bigint;
    try {
      offerUntil = BigInt(data.offerValidUntilSeconds);
    } catch {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "offerValidUntilSeconds must be a non-negative integer string",
        path: ["offerValidUntilSeconds"],
      });
      return;
    }

    const { minInclusive, maxInclusive } = offerValidUntilAcceptableRange(nowSeconds);
    if (offerUntil < minInclusive || offerUntil > maxInclusive) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "offerValidUntilSeconds must be within the default listing window (10 calendar years from server time, ±1 year for clock drift)",
        path: ["offerValidUntilSeconds"],
      });
    }

    let expiresAt: bigint;
    try {
      expiresAt = BigInt(data.expiresAtSeconds);
    } catch {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "expiresAtSeconds must be a non-negative integer string",
        path: ["expiresAtSeconds"],
      });
      return;
    }

    if (expiresAt <= nowSeconds) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "expiresAtSeconds must be strictly in the future",
        path: ["expiresAtSeconds"],
      });
    }

    const maxChallenge = nowSeconds + BigInt(CHALLENGE_MAX_LIFETIME_SECONDS);
    if (expiresAt > maxChallenge) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `expiresAtSeconds must be at most ${CHALLENGE_MAX_LIFETIME_SECONDS} seconds after server time`,
        path: ["expiresAtSeconds"],
      });
    }
  });

export type Input = z.infer<typeof inputSchema>;

export interface Output {
  offerId: string;
}

function numericStringWithinRange(min: bigint, max: bigint, message: string) {
  return z
    .string()
    .regex(NUMERIC_STRING, "value must be a numeric string")
    .refine((value) => {
      const numericValue = BigInt(value);
      return numericValue >= min && numericValue <= max;
    }, message);
}
