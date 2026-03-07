import { getEventsRepository } from "@/lib/repositories/events/get-events-repository";
import { ATTR_RESULT_COUNT } from "@/lib/telemetry/traceConstants";
import { withSpan } from "@/lib/telemetry/withSpan";
import { calculatePnl, calculatePnlPercent, getMoneyStatus, getTradeResult } from "./pnl";
import type { HistoryEntry, Output, TradeRole } from "./schema";

const GET_HISTORY_SPAN_NAME = "usecase.history.get_history";

export async function getHistory(principal: string): Promise<Output> {
  return withSpan(GET_HISTORY_SPAN_NAME, async (span) => {
    const repository = getEventsRepository();
    const events = await repository.getEventsByPrincipal(principal, { limit: 1000 });
    const entries: HistoryEntry[] = [];

    for (const event of events) {
      if (event.data.type !== "OptionSettled") {
        continue;
      }

      const data = event.data;
      const role: TradeRole = data.role === "Buyer" ? "buyer" : "writer";
      const quantitySats = BigInt(data.quantitySats);
      const premiumSats = BigInt(data.premiumSats);
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
        acceptedAt: BigInt(data.acceptedAtNs),
        settledAt: BigInt(data.settledAtNs),
      });
    }

    entries.sort((a, b) => Number(b.settledAt - a.settledAt));
    span.setAttribute(ATTR_RESULT_COUNT, entries.length);

    return { entries };
  });
}
