import { ImageResponse } from "next/og";
import { logError } from "@/lib/telemetry/logs";
import type { HistoryEntry } from "@/lib/use-cases/history/get-history/schema";
import { getHistoryByHash } from "@/lib/use-cases/history/get-history-by-hash/usecase";
import { formatBtcBigint, getFallbackUsername } from "@/lib/utils";

const BG_COLOR = "#FFF9F5";
const CARD_COLOR = "#FFFFFF";
const TEXT_COLOR = "#3D3935";
const MUTED_TEXT = "#8A8378";
const BORDER_COLOR = "#FFE0D6";
const PRIMARY_COLOR = "#E37B00";
const ARC_COLOR = "#F5D4BF";

function formatSignedBtc(sats: bigint): string {
  const sign = sats > BigInt(0) ? "+" : sats < BigInt(0) ? "-" : "";
  const abs = sats < BigInt(0) ? -sats : sats;
  return `${sign}${formatBtcBigint(abs, 5)} BTC`;
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const queryLocale = searchParams.get("locale");

    const referer = request.headers.get("referer") || "";
    const locale =
      queryLocale || (referer.includes("/zh/") || referer.includes("/zh") ? "zh" : "en");
    const isZh = locale === "zh";

    const history = await getHistoryByHash(id);

    const entries = history?.entries ?? [];
    const username = history?.username || getFallbackUsername(id, locale);
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://isometric.fi";
    const avatarUrl = `${baseUrl}/api/avatar?name=${encodeURIComponent(id)}`;

    const totalPnlSats = entries.reduce(
      (sum: bigint, e: HistoryEntry) => sum + e.pnlSats,
      BigInt(0),
    );
    const profitableTrades = entries.filter((e: HistoryEntry) => e.result === "profit").length;
    const winRate = entries.length > 0 ? (profitableTrades / entries.length) * 100 : 0;

    const pnlText = formatSignedBtc(totalPnlSats);
    const tradesText = `${entries.length}`;
    const winRateText = `${winRate.toFixed(0)}%`;

    const joinLabel = isZh ? "加入" : "Join";
    const tradingLabel = isZh ? "交易" : "trading";
    const bitcoinOptionsLabel = isZh ? "比特币期权" : "Bitcoin options";

    const pnlLabel = isZh ? "盈亏" : "PnL";
    const tradesLabel = isZh ? "交易" : "Trades";
    const winRateLabel = isZh ? "胜率" : "Win rate";

    return new ImageResponse(
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          backgroundColor: BG_COLOR,
          color: TEXT_COLOR,
          fontFamily: "Montserrat, sans-serif",
          position: "relative",
          padding: "60px",
        }}
      >
        {/* Decorative concentric arcs (top-right origin) */}
        <svg
          width="1200"
          height="630"
          viewBox="0 0 1200 630"
          fill="none"
          style={{ position: "absolute", top: 0, left: 0 }}
          aria-hidden="true"
        >
          {[160, 300, 440, 580, 720, 860, 1000, 1140, 1280].map((r, i, arr) => {
            const opacity = 1 - i / (arr.length - 1);
            return (
              <circle
                key={r}
                cx="1200"
                cy="0"
                r={r}
                stroke={ARC_COLOR}
                strokeOpacity={0.15 + opacity * 0.55}
                strokeWidth="3"
                fill="none"
              />
            );
          })}
        </svg>

        {/* Title block */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
            flex: 1,
            justifyContent: "flex-start",
          }}
        >
          {/* Line 1: Join [pill] */}
          <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
            <span
              style={{
                fontSize: 80,
                fontWeight: 700,
                color: TEXT_COLOR,
                lineHeight: 1,
              }}
            >
              {joinLabel}
            </span>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 18,
                backgroundColor: CARD_COLOR,
                border: `3px solid ${BORDER_COLOR}`,
                borderRadius: 999,
                padding: "8px 32px 8px 8px",
              }}
            >
              {/* biome-ignore lint: og image rendering */}
              <img src={avatarUrl} alt="" width={76} height={76} style={{ borderRadius: 999 }} />
              <span
                style={{
                  fontSize: 70,
                  fontWeight: 700,
                  color: TEXT_COLOR,
                  lineHeight: 1,
                }}
              >
                {username}
              </span>
            </div>
          </div>

          {/* Line 2: trading Bitcoin options */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 24,
              marginTop: 18,
            }}
          >
            <span
              style={{
                fontSize: 80,
                fontWeight: 700,
                color: TEXT_COLOR,
                lineHeight: 1,
              }}
            >
              {tradingLabel}
            </span>
            <span
              style={{
                fontSize: 80,
                fontWeight: 700,
                color: PRIMARY_COLOR,
                lineHeight: 1,
              }}
            >
              {bitcoinOptionsLabel}
            </span>
          </div>
        </div>

        {/* Stats row */}
        <div style={{ display: "flex", gap: 20, marginTop: 12 }}>
          {[
            { label: pnlLabel, value: pnlText },
            { label: tradesLabel, value: tradesText },
            { label: winRateLabel, value: winRateText },
          ].map((stat) => (
            <div
              key={stat.label}
              style={{
                display: "flex",
                flex: 1,
                flexDirection: "column",
                backgroundColor: CARD_COLOR,
                border: `3px solid ${BORDER_COLOR}`,
                borderRadius: 24,
                padding: "22px 32px",
                gap: 6,
              }}
            >
              <span style={{ fontSize: 32, fontWeight: 500, color: MUTED_TEXT }}>{stat.label}</span>
              <span style={{ fontSize: 40, fontWeight: 700, color: TEXT_COLOR }}>{stat.value}</span>
            </div>
          ))}
        </div>

        {/* Footer: logo + wordmark */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 18,
            marginTop: 44,
          }}
        >
          <svg
            width="56"
            height="56"
            viewBox="0 0 200 200"
            fill="none"
            role="img"
            aria-label="Isometric logo"
          >
            <path
              d="M84.8747 12.2818C93.458 4.79205 106.226 4.79568 114.807 12.287C141.249 35.3696 164.63 58.7521 187.713 85.1932C195.204 93.7746 195.209 106.543 187.719 115.125C164.775 141.417 141.417 164.775 115.125 187.719C106.543 195.209 93.7747 195.204 85.1933 187.713C58.7521 164.63 35.3698 141.249 12.2871 114.807C4.79579 106.226 4.79219 93.4579 12.2819 84.8746C35.2253 58.5834 58.5835 35.2252 84.8747 12.2818Z"
              fill="#FFCE51"
            />
            <path
              d="M99.988 100.006C107.778 92.216 142.393 89.7354 162.99 94.1247C171.316 95.8987 172.561 104.964 167.033 111.437C149.891 131.505 131.488 149.908 111.42 167.049C104.947 172.578 95.882 171.333 94.1073 163.007C89.7187 142.411 92.1987 107.796 99.988 100.006Z"
              fill="#E37B00"
            />
            <path
              d="M88.5573 32.9616C95.0306 27.4326 104.095 28.6778 105.87 37.0039C110.259 57.6007 107.778 92.216 99.988 100.006C92.198 107.795 57.5841 110.276 36.9876 105.887C28.6614 104.113 27.4162 95.0473 32.9452 88.574C50.086 68.5067 68.4893 50.1025 88.5573 32.9616Z"
              fill="#E37B00"
            />
          </svg>
          <span style={{ fontSize: 40, fontWeight: 500, color: TEXT_COLOR }}>Isometric.fi</span>
        </div>
      </div>,
      {
        width: 1200,
        height: 630,
      },
    );
  } catch (error) {
    await logError("OG Image generation error", error);
    const referer = request.headers.get("referer") || "";
    const isZh = referer.includes("/zh/") || referer.includes("/zh");

    return new ImageResponse(
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: BG_COLOR,
          color: TEXT_COLOR,
        }}
      >
        <div style={{ fontSize: 64, fontWeight: 700 }}>Isometric.fi</div>
        <div
          style={{
            fontSize: 28,
            fontWeight: 500,
            marginTop: 16,
            color: MUTED_TEXT,
          }}
        >
          {isZh ? "加载统计数据出错" : "Error loading stats"}
        </div>
      </div>,
      {
        width: 1200,
        height: 630,
      },
    );
  }
}
