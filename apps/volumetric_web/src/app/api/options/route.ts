import "server-only";
import { NextResponse } from "next/server";
import type { OptionOffer, OptionsData } from "@/types/options";

function generateMockOptionsData(): OptionsData {
  const now = new Date();

  const createOffer = (id: string, amountSats: number, premium: number): OptionOffer => ({
    id,
    writerId: `writer-${Math.random().toString(36).slice(2, 8)}`,
    amountSats,
    premium,
    createdAt: new Date(now.getTime() - Math.random() * 86400000 * 7).toISOString(),
  });

  return {
    termGroups: [
      {
        term: 7,
        expiryDate: new Date(now.getTime() + 7 * 86400000).toISOString(),
        strikes: [
          {
            strikePercent: 5,
            offers: [
              createOffer("1", 50_000_000, 0.75),
              createOffer("2", 25_000_000, 0.5),
              createOffer("3", 100_000_000, 1.0),
              createOffer("4", 100_000_000, 1.0),
              createOffer("5", 100_000_000, 1.0),
              createOffer("6", 100_000_000, 1.0),
              createOffer("7", 100_000_000, 1.0),
            ],
            totalLiquiditySats: 575_000_000,
            lowestPremium: 0.5,
            highestPremium: 1.0,
          },
          {
            strikePercent: 10,
            offers: [
              createOffer("8", 200_000_000, 1.25),
              createOffer("9", 75_000_000, 1.0),
              createOffer("10", 50_000_000, 1.5),
              createOffer("11", 150_000_000, 1.25),
            ],
            totalLiquiditySats: 475_000_000,
            lowestPremium: 1.0,
            highestPremium: 1.5,
          },
          {
            strikePercent: 15,
            offers: [createOffer("12", 30_000_000, 2.0), createOffer("13", 20_000_000, 1.75)],
            totalLiquiditySats: 50_000_000,
            lowestPremium: 1.75,
            highestPremium: 2.0,
          },
        ],
      },
      {
        term: 14,
        expiryDate: new Date(now.getTime() + 14 * 86400000).toISOString(),
        strikes: [
          {
            strikePercent: 5,
            offers: [createOffer("17", 100_000_000, 1.5)],
            totalLiquiditySats: 100_000_000,
            lowestPremium: 1.5,
            highestPremium: 1.5,
          },
          {
            strikePercent: 10,
            offers: [createOffer("18", 50_000_000, 2.0), createOffer("19", 125_000_000, 2.25)],
            totalLiquiditySats: 175_000_000,
            lowestPremium: 2.0,
            highestPremium: 2.25,
          },
          {
            strikePercent: 15,
            offers: [createOffer("20", 75_000_000, 2.5)],
            totalLiquiditySats: 75_000_000,
            lowestPremium: 2.5,
            highestPremium: 2.5,
          },
        ],
      },
    ],
  };
}

export async function GET() {
  const data = generateMockOptionsData();
  return NextResponse.json(data);
}
