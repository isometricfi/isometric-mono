import { getCanisterActor } from "@/lib/canister-server";
import { groupOffersByTermAndStrike } from "@/lib/options-transformer";
import type { OptionsData } from "@/types/options";

export async function listOptions(): Promise<OptionsData> {
  const actor = await getCanisterActor();
  const offers = await actor.get_open_offers();
  return groupOffersByTermAndStrike(offers);
}
