import "server-only";
import { NextResponse } from "next/server";
import { getCanisterActor } from "@/lib/canister-server";
import { groupOffersByTermAndStrike } from "@/lib/options-transformer";
import type { OptionsData } from "@/types/options";

export async function GET() {
  try {
    const actor = await getCanisterActor();
    const offers = await actor.get_open_offers();
    const data = groupOffersByTermAndStrike(offers);
    return NextResponse.json(data);
  } catch (error) {
    console.error("[options] failed to fetch offers:", error);
    return NextResponse.json({ termGroups: [] } satisfies OptionsData);
  }
}
