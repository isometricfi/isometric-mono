import { z } from "zod";
import { FEATURE_KEYS } from "../feature-keys";

export const inputSchema = z.object({
  featureKey: z.enum(FEATURE_KEYS),
  address: z.string().min(1).optional(),
});

export type Input = z.infer<typeof inputSchema>;

export interface Output {
  featureKey: (typeof FEATURE_KEYS)[number];
  hasVoted: boolean;
  totalInterested: number;
}
