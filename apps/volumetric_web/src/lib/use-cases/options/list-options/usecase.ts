import type { Principal } from "@icp-sdk/core/principal";
import { getCanisterActor } from "@/lib/canister-server";
import { groupOffersByTermAndStrike } from "@/lib/options-transformer";
import { ATTR_RESULT_COUNT } from "@/lib/telemetry/traceConstants";
import { withSpan } from "@/lib/telemetry/withSpan";
import type { OptionsData } from "@/types/options";

const LIST_OPTIONS_SPAN_NAME = "usecase.options.list_options";

export async function listOptions(): Promise<OptionsData> {
  return withSpan(LIST_OPTIONS_SPAN_NAME, async (span) => {
    const actor = await getCanisterActor();
    const offers = await actor.get_open_offers();

    const uniqueWriters = new Map<string, Principal>();
    for (const offer of offers) {
      uniqueWriters.set(offer.writer.toText(), offer.writer);
    }

    const writerEntries = Array.from(uniqueWriters.entries());
    const balanceResults = await Promise.allSettled(
      writerEntries.map(([, principal]) => actor.get_user_balance_by_principal(principal)),
    );

    const balancesByWriter = new Map<string, bigint>();
    writerEntries.forEach(([writerText], idx) => {
      const settled = balanceResults[idx];
      if (settled.status === "fulfilled" && "Ok" in settled.value) {
        balancesByWriter.set(writerText, settled.value.Ok.available);
      } else {
        balancesByWriter.set(writerText, BigInt(0));
      }
    });

    const optionsData = groupOffersByTermAndStrike(offers, balancesByWriter);

    span.setAttribute(ATTR_RESULT_COUNT, optionsData.termGroups.length);
    span.setAttribute("unique_writers_count", uniqueWriters.size);
    return optionsData;
  });
}
