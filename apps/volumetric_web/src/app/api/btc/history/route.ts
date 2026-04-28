import { type NextRequest, NextResponse } from "next/server";

const EDGE_TTL_SECONDS = 300;
const SWR_SECONDS = 600;
const MAX_DAYS = 365;

interface CoinGeckoMarketChartResponse {
  prices: [number, number][];
}

export async function GET(request: NextRequest) {
  const daysParam = request.nextUrl.searchParams.get("days") ?? "30";
  const days = Number(daysParam);

  if (!Number.isInteger(days) || days < 1 || days > MAX_DAYS) {
    return NextResponse.json(
      { error: "Invalid days parameter" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const upstream = await fetch(
    `https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=usd&days=${days}`,
    { next: { revalidate: EDGE_TTL_SECONDS } },
  );

  if (!upstream.ok) {
    return NextResponse.json(
      { error: "Failed to fetch BTC history" },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }

  const data = (await upstream.json()) as CoinGeckoMarketChartResponse;

  return NextResponse.json(
    { prices: data.prices },
    {
      headers: {
        "Cache-Control": `public, s-maxage=${EDGE_TTL_SECONDS}, stale-while-revalidate=${SWR_SECONDS}`,
      },
    },
  );
}
