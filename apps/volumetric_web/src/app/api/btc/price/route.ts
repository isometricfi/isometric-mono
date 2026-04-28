import { NextResponse } from "next/server";

const COINGECKO_URL = "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd";

const EDGE_TTL_SECONDS = 30;
const SWR_SECONDS = 60;

export async function GET() {
  const upstream = await fetch(COINGECKO_URL, {
    next: { revalidate: EDGE_TTL_SECONDS },
  });

  if (!upstream.ok) {
    return NextResponse.json(
      { error: "Failed to fetch prices" },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }

  const data = (await upstream.json()) as { bitcoin?: { usd?: number } };
  const btc = data.bitcoin?.usd;

  if (typeof btc !== "number") {
    return NextResponse.json(
      { error: "Unexpected upstream payload" },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }

  return NextResponse.json(
    { btc },
    {
      headers: {
        "Cache-Control": `public, s-maxage=${EDGE_TTL_SECONDS}, stale-while-revalidate=${SWR_SECONDS}`,
      },
    },
  );
}
