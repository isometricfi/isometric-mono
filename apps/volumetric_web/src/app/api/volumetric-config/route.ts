import "server-only";
import { NextResponse } from "next/server";
import type { ConfigData } from "@/types/config";

export async function GET() {
  const config: ConfigData = {
    termOptions: [7, 14],
    strikePercentOptions: [5, 10, 15],
    premium: {
      min: 0.5,
      max: 5,
      step: 0.25,
    },
    minOfferAmountSats: 100_000,
    maxOfferAmountSats: 100_000_000,
    minDepositAmountSats: 50_000,
    minWithdrawAmountSats: 50_000,
  };

  return NextResponse.json(config);
}
