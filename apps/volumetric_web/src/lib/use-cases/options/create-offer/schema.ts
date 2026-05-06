import { z } from "zod";
import { CHALLENGE_MAX_LIFETIME_SECONDS, walletProofInputSchema } from "../../_shared/wallet-proof";
import { offerValidUntilAcceptableRange } from "./offer-valid-until-policy";

const NUMERIC_STRING = /^\d+$/;

export const inputSchema = walletProofInputSchema
  .extend({
    quantity: z.string().regex(NUMERIC_STRING, "quantity must be a numeric string"),
    strikeBasisPoints: z.number(),
    premiumBasisPoints: z.number(),
    offerValidUntilSeconds: z
      .string()
      .regex(NUMERIC_STRING, "offerValidUntilSeconds must be a numeric string"),
    optionDurationSeconds: z
      .string()
      .regex(NUMERIC_STRING, "optionDurationSeconds must be a numeric string"),
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
