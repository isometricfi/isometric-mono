import "server-only";
import { NextResponse } from "next/server";
import { getCanisterActor } from "@/lib/canister-server";
import { groupOffersByTermAndStrike } from "@/lib/options-transformer";
import type { OptionsData } from "@/types/options";

export async function GET() {
  try {
    const actor = await getCanisterActor();
    console.log("[options] fetching open offers from canister...");
    const offers = await actor.get_open_offers();
    console.log(
      "[options] raw offers from canister:",
      JSON.stringify(offers, (_, v) => (typeof v === "bigint" ? v.toString() : v)),
    );
    console.log("[options] offers count:", offers.length);
    const data = groupOffersByTermAndStrike(offers);
    console.log("[options] transformed data:", JSON.stringify(data));
    return NextResponse.json(data);
  } catch (error) {
    console.error("[options] failed to fetch offers:", error);
    return NextResponse.json({ termGroups: [] } satisfies OptionsData);
  }
}
