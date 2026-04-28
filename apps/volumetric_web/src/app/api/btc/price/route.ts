import { NextResponse } from "next/server";

const COINGECKO_URL = "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd";

const EDGE_TTL_SECONDS = 30;
const SWR_SECONDS = 60;
const UPSTREAM_TIMEOUT_MS = 5_000;

function upstreamError(message: string) {
  return NextResponse.json(
    { error: message },
    { status: 502, headers: { "Cache-Control": "no-store" } },
  );
}

export async function GET() {
  let upstream: Response;
  try {
    upstream = await fetch(COINGECKO_URL, {
      next: { revalidate: EDGE_TTL_SECONDS },
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
  } catch {
    return upstreamError("Upstream unreachable");
  }

  if (!upstream.ok) {
    return upstreamError("Failed to fetch prices");
  }

  let btc: number | undefined;
  try {
    const data = (await upstream.json()) as { bitcoin?: { usd?: number } };
    btc = data.bitcoin?.usd;
  } catch {
    return upstreamError("Failed to parse upstream payload");
  }

  if (typeof btc !== "number") {
    return upstreamError("Unexpected upstream payload");
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
