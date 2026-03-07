import { unwrapResult } from "@volumetric/canister-types";
import { getCanisterActor } from "@/lib/canister-server";
import { withSpan } from "@/lib/telemetry/withSpan";
import { isActiveOffer, isActiveOption, mapOffer, mapOption } from "./mapper";
import type { Output } from "./schema";

const GET_PORTFOLIO_SPAN_NAME = "usecase.portfolio.get_portfolio";

export async function getPortfolio(address: string): Promise<Output> {
  return withSpan(GET_PORTFOLIO_SPAN_NAME, async () => {
    const actor = await getCanisterActor();

    const [offersResult, boughtResult, writtenResult] = await Promise.all([
      actor.get_my_offers(address),
      actor.get_my_options(address),
      actor.get_my_written_options(address),
    ]);

    const rawOffers = unwrapResult(offersResult);
    const boughtOptions = unwrapResult(boughtResult);
    const writtenOptions = unwrapResult(writtenResult);

    return {
      offers: rawOffers.filter(isActiveOffer).map(mapOffer),
      boughtOptions: boughtOptions.filter(isActiveOption).map(mapOption),
      writtenOptions: writtenOptions.filter(isActiveOption).map(mapOption),
    };
  });
}
