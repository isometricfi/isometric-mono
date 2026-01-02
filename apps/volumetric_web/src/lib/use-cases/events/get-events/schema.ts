import { z } from "zod";

export const tradeRoleSchema = z.enum(["Buyer", "Writer"]);

export const eventTypeSchema = z.enum([
  "AccountCreated",
  "UsernameUpdated",
  "Deposit",
  "Withdrawal",
  "WithdrawalFailed",
  "OfferCreated",
  "OfferCancelled",
  "OfferAccepted",
  "OfferAcceptFailed",
  "OptionSettled",
  "OptionSettlementFailed",
  "Unknown",
]);

export const eventDataSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("AccountCreated"),
    walletAddress: z.string(),
  }),
  z.object({
    type: z.literal("UsernameUpdated"),
    oldUsername: z.string().nullable(),
    newUsername: z.string(),
  }),
  z.object({
    type: z.literal("Deposit"),
    amountSats: z.number(),
  }),
  z.object({
    type: z.literal("Withdrawal"),
    amountSats: z.number(),
    destination: z.string(),
  }),
  z.object({
    type: z.literal("WithdrawalFailed"),
    amountSats: z.number(),
    reason: z.string(),
  }),
  z.object({
    type: z.literal("OfferCreated"),
    offerId: z.string(),
    quantitySats: z.number(),
    strikeBasisPoints: z.number(),
    premiumBasisPoints: z.number(),
    durationSeconds: z.number(),
    offerValidUntilNs: z.number(),
  }),
  z.object({
    type: z.literal("OfferCancelled"),
    offerId: z.string(),
    remainingQuantitySats: z.number(),
  }),
  z.object({
    type: z.literal("OfferAccepted"),
    offerId: z.string(),
    optionId: z.string(),
    fillGroupId: z.string(),
    counterparty: z.string(),
    quantitySats: z.number(),
    premiumSats: z.number(),
    entryPriceCents: z.number(),
    strikePriceCents: z.number(),
    expiryNs: z.number(),
    role: tradeRoleSchema,
  }),
  z.object({
    type: z.literal("OfferAcceptFailed"),
    offerIds: z.array(z.string()),
    reason: z.string(),
  }),
  z.object({
    type: z.literal("OptionSettled"),
    optionId: z.string(),
    quantitySats: z.number(),
    entryPriceCents: z.number(),
    strikePriceCents: z.number(),
    settlementPriceCents: z.number(),
    premiumSats: z.number(),
    payoutSats: z.number(),
    acceptedAtNs: z.number(),
    settledAtNs: z.number(),
    role: tradeRoleSchema,
  }),
  z.object({
    type: z.literal("OptionSettlementFailed"),
    optionId: z.string(),
    reason: z.string(),
  }),
  z.object({
    type: z.literal("Unknown"),
  }),
]);

export const eventSchema = z.object({
  id: z.string(),
  eventType: eventTypeSchema,
  principal: z.string(),
  timestamp: z.number(),
  data: eventDataSchema,
});

export const inputSchema = z.object({
  afterId: z.string().optional(),
  limit: z.number().optional(),
});

export const outputSchema = z.array(eventSchema);

export type TradeRole = z.infer<typeof tradeRoleSchema>;
export type EventType = z.infer<typeof eventTypeSchema>;
export type EventData = z.infer<typeof eventDataSchema>;
export type Event = z.infer<typeof eventSchema>;
export type Input = z.infer<typeof inputSchema>;
export type Output = z.infer<typeof outputSchema>;
