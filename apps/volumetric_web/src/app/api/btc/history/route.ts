import { type NextRequest, NextResponse } from "next/server";

const EDGE_TTL_SECONDS = 300;
const SWR_SECONDS = 600;
const MAX_DAYS = 365;
const UPSTREAM_TIMEOUT_MS = 5_000;

interface CoinGeckoMarketChartResponse {
  prices: [number, number][];
}

function upstreamError(message: string) {
  return NextResponse.json(
    { error: message },
    { status: 502, headers: { "Cache-Control": "no-store" } },
  );
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

  let upstream: Response;
  try {
    upstream = await fetch(
      `https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=usd&days=${days}`,
      {
        next: { revalidate: EDGE_TTL_SECONDS },
        signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      },
    );
  } catch {
    return upstreamError("Upstream unreachable");
  }

  if (!upstream.ok) {
    return upstreamError("Failed to fetch BTC history");
  }

  let prices: CoinGeckoMarketChartResponse["prices"];
  try {
    const data = (await upstream.json()) as CoinGeckoMarketChartResponse;
    prices = data.prices;
  } catch {
    return upstreamError("Failed to parse upstream payload");
  }

  if (!Array.isArray(prices)) {
    return upstreamError("Unexpected upstream payload");
  }

  return NextResponse.json(
    { prices },
    {
      headers: {
        "Cache-Control": `public, s-maxage=${EDGE_TTL_SECONDS}, stale-while-revalidate=${SWR_SECONDS}`,
      },
    },
  );
}
