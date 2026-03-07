import { ImageResponse } from "next/og";
import { logError } from "@/lib/telemetry/logs";
import type { HistoryEntry } from "@/lib/use-cases/history/get-history/schema";
import { getHistoryByHash } from "@/lib/use-cases/history/get-history-by-hash/usecase";
import { formatBtcBigint, getFallbackUsername } from "@/lib/utils";

function formatBtcForOG(sats: bigint, maxDecimals = 8): string {
  const formatted = formatBtcBigint(sats, maxDecimals);
  return `${formatted} BTC`;
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

    // Sort entries by acceptedAt to find the first trade (oldest)
    const sortedEntries = [...entries].sort((a, b) => Number(a.acceptedAt - b.acceptedAt));
    const firstTrade = sortedEntries[0];
    const joinedText = firstTrade
      ? `${isZh ? "加入于" : "Joined"} ${new Date(Number(firstTrade.acceptedAt / BigInt(1_000_000))).toLocaleDateString(isZh ? "zh-CN" : "en-US", { month: "long", year: "numeric" })}`
      : isZh
        ? "新成员"
        : "New Member";

    const totalPnlSats = entries.reduce(
      (sum: bigint, e: HistoryEntry) => sum + e.pnlSats,
      BigInt(0),
    );
    const profitableTrades = entries.filter((e: HistoryEntry) => e.result === "profit").length;
    const winRate = entries.length > 0 ? (profitableTrades / entries.length) * 100 : 0;
    const totalVolumeSats = entries.reduce(
      (sum: bigint, e: HistoryEntry) => sum + e.quantitySats,
      BigInt(0),
    );

    const isProfit = totalPnlSats >= BigInt(0);
    const pnlColor = isProfit ? "#22c55e" : "#ef4444";
    const pnlText = formatBtcForOG(totalPnlSats, 6);
    const volumeText = formatBtcForOG(totalVolumeSats, 5);
    const winRateText = `${winRate.toFixed(1)}%`;
    const tradesText = `${entries.length}`;

    // Light theme colors from globals.css
    const BG_COLOR = "#FFF9F5"; // oklch(0.9856 0.0084 56.3169) - background
    const CARD_COLOR = "#ffffff"; // oklch(1 0 0) - card
    const TEXT_COLOR = "#3d3935"; // oklch(0.3353 0.0132 2.7676) - foreground
    const MUTED_TEXT = "#8a8378"; // oklch(0.5534 0.0116 58.0708) - muted-foreground
    const BORDER_COLOR = "#FFE0D6"; // oklch(0.9296 0.037 38.6868) - border
    const _PRIMARY_COLOR = "#e67e22"; // oklch(0.7357 0.1641 34.7091) - primary (orange)
    // unused, kept for potential future use

    return new ImageResponse(
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          backgroundColor: BG_COLOR,
          color: TEXT_COLOR,
          padding: "40px",
          fontFamily: "Montserrat, sans-serif",
        }}
      >
        {/* Header with Avatar and Logo */}
        <div style={{ display: "flex", alignItems: "center", marginBottom: 30 }}>
          {/* biome-ignore lint: og image rendering */}
          <img
            src={avatarUrl}
            alt="Avatar"
            width={100}
            height={100}
            style={{ borderRadius: 50, marginRight: 24 }}
          />
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 48, fontWeight: 800, color: TEXT_COLOR }}>{username}</div>
            <div style={{ fontSize: 30, fontWeight: 500, color: MUTED_TEXT, marginTop: 4 }}>
              {joinedText}
            </div>
          </div>
          <div style={{ display: "flex", marginLeft: "auto", alignItems: "center" }}>
            {/* SVG Logo */}
            <svg
              width="70"
              height="70"
              viewBox="0 0 200 200"
              fill="none"
              style={{ marginRight: 16 }}
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
            <div style={{ fontSize: 48, fontWeight: 800, color: TEXT_COLOR }}>Isometric</div>
          </div>
        </div>

        {/* Stats Grid */}
        <div
          style={{
            display: "flex",
            flex: 1,
            flexDirection: "column",
            gap: 10,
          }}
        >
          {/* Main P&L Row */}
          <div
            style={{
              display: "flex",
              padding: "24px 32px",
              backgroundColor: CARD_COLOR,
              borderRadius: "40px",
              border: `2px solid ${BORDER_COLOR}`,
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 20,
            }}
          >
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div
                style={{
                  fontSize: 30,
                  fontWeight: 600,
                  color: MUTED_TEXT,
                  marginBottom: 4,
                  letterSpacing: "0.05em",
                }}
              >
                {isZh ? "总盈亏" : "Total P&L"}
              </div>
              <div style={{ fontSize: 56, fontWeight: 800, color: pnlColor }}>{pnlText}</div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
              <div
                style={{
                  fontSize: 30,
                  fontWeight: 600,
                  color: MUTED_TEXT,
                  marginBottom: 4,
                  letterSpacing: "0.05em",
                }}
              >
                {isZh ? "成功率" : "Success Rate"}
              </div>
              <div style={{ fontSize: 56, fontWeight: 800, color: TEXT_COLOR }}>{winRateText}</div>
            </div>
          </div>

          {/* Secondary Stats Row */}
          <div style={{ display: "flex", gap: 24 }}>
            <div
              style={{
                display: "flex",
                flex: 1,
                padding: "24px 32px",
                backgroundColor: CARD_COLOR,
                borderRadius: "35px",
                border: `2px solid ${BORDER_COLOR}`,
                flexDirection: "column",
              }}
            >
              <div
                style={{
                  fontSize: 30,
                  fontWeight: 600,
                  color: MUTED_TEXT,
                  marginBottom: 8,
                  letterSpacing: "0.05em",
                }}
              >
                {isZh ? "总交易量" : "Total Volume"}
              </div>
              <div style={{ fontSize: 36, fontWeight: 700, color: TEXT_COLOR }}>{volumeText}</div>
            </div>

            <div
              style={{
                display: "flex",
                flex: 1,
                padding: "24px 32px",
                backgroundColor: CARD_COLOR,
                borderRadius: "35px",
                border: `2px solid ${BORDER_COLOR}`,
                flexDirection: "column",
              }}
            >
              <div
                style={{
                  fontSize: 30,
                  fontWeight: 600,
                  color: MUTED_TEXT,
                  marginBottom: 8,
                  letterSpacing: "0.05em",
                }}
              >
                {isZh ? "总交易数" : "Total Trades"}
              </div>
              <div style={{ fontSize: 36, fontWeight: 700, color: TEXT_COLOR }}>{tradesText}</div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginTop: 40,
            color: MUTED_TEXT,
            fontSize: 24,
            fontWeight: 500,
            letterSpacing: "0.05em",
          }}
        >
          <div>isometric.app</div>
          <div>{isZh ? "人人可用的比特币期权" : "Bitcoin Options For Everyone"}</div>
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
          backgroundColor: "#000000",
          color: "white",
        }}
      >
        <div style={{ fontSize: 48, fontWeight: 800 }}>Isometric</div>
        <div style={{ fontSize: 24, fontWeight: 500, marginTop: 20, opacity: 0.7 }}>
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
