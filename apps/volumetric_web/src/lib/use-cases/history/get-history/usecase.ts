import { getEventsRepository } from "@/lib/repositories/events/get-events-repository";
import { ATTR_RESULT_COUNT } from "@/lib/telemetry/traceConstants";
import { withSpan } from "@/lib/telemetry/withSpan";
import { getConfig } from "@/lib/use-cases/config/get-config/usecase";
import { eventDataSchema } from "@/lib/use-cases/events/get-events/schema";
import {
  calculatePnl,
  calculatePnlPercent,
  getMoneyStatus,
  getTradeResult,
  netPremiumSatsForRole,
} from "./pnl";
import type { HistoryEntry, Output, TradeRole } from "./schema";

const GET_HISTORY_SPAN_NAME = "usecase.history.get_history";

export async function getHistory(principal: string): Promise<Output> {
  return withSpan(GET_HISTORY_SPAN_NAME, async (span) => {
    const repository = getEventsRepository();
    const [events, config] = await Promise.all([
      repository.getEventsByPrincipal(principal, { limit: 1000 }),
      getConfig(),
    ]);
    const premiumFeeBps = config.fees.premiumFeeBasisPoints;
    const entries: HistoryEntry[] = [];

    for (const event of events) {
      const parsedData = eventDataSchema.safeParse(event.data);
      if (!parsedData.success || parsedData.data.type !== "OptionSettled") {
        continue;
      }

      const data = parsedData.data;
      const role: TradeRole = data.role === "Buyer" ? "buyer" : "writer";
      const quantitySats = BigInt(data.quantitySats);
      const premiumSats = netPremiumSatsForRole(BigInt(data.premiumSats), premiumFeeBps, role);
      const payoutSats = BigInt(data.payoutSats);
      const strikePriceCents = BigInt(data.strikePriceCents);
      const entryPriceCents = BigInt(data.entryPriceCents);
      const settlementPriceCents = BigInt(data.settlementPriceCents);

      const pnlSats = calculatePnl(role, premiumSats, payoutSats, quantitySats);
      const pnlPercent = calculatePnlPercent(role, pnlSats, premiumSats, quantitySats);

      entries.push({
        id: `${event.id}-${data.optionId}`,
        role,
        optionType: "call",
        quantitySats,
        strikePriceCents,
        entryPriceCents,
        settlementPriceCents,
        premiumSats,
        payoutSats,
        pnlSats,
        pnlPercent,
        result: getTradeResult(pnlSats),
        moneyStatus: getMoneyStatus(strikePriceCents, settlementPriceCents),
        acceptedAt: BigInt(data.acceptedAtSeconds),
        settledAt: BigInt(data.settledAtSeconds),
      });
    }

    entries.sort((a, b) => Number(b.settledAt - a.settledAt));
    span.setAttribute(ATTR_RESULT_COUNT, entries.length);

    return { entries };
  });
}
