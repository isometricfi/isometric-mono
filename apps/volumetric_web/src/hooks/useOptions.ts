import { useQuery } from "@tanstack/react-query";
import type { OptionOffer, OptionsData, TermGroup } from "@/store/optionsStore";

function generateMockOptionsData(): OptionsData {
  const now = new Date();

  const createOffer = (id: string, amountSats: number, premium: number): OptionOffer => ({
    id,
    writerId: `writer-${Math.random().toString(36).slice(2, 8)}`,
    amountSats,
    premium,
    createdAt: new Date(now.getTime() - Math.random() * 86400000 * 7),
  });

  const termGroups: TermGroup[] = [
    {
      term: 7,
      expiryDate: new Date(now.getTime() + 7 * 86400000),
      strikes: [
        {
          strikePercent: 5,
          offers: [
            createOffer("1", 50_000_000, 0.75), // 0.5 BTC
            createOffer("2", 25_000_000, 0.5), // 0.25 BTC
            createOffer("3", 100_000_000, 1.0), // 1 BTC
            createOffer("4", 100_000_000, 1.0),
            createOffer("5", 100_000_000, 1.0),
            createOffer("6", 100_000_000, 1.0),
            createOffer("7", 100_000_000, 1.0),
          ],
          totalLiquiditySats: 575_000_000, // 5.75 BTC
          lowestPremium: 0.5,
          highestPremium: 1.0,
        },
        {
          strikePercent: 10,
          offers: [
            createOffer("8", 200_000_000, 1.25), // 2 BTC
            createOffer("9", 75_000_000, 1.0), // 0.75 BTC
            createOffer("10", 50_000_000, 1.5), // 0.5 BTC
            createOffer("11", 150_000_000, 1.25), // 1.5 BTC
          ],
          totalLiquiditySats: 475_000_000, // 4.75 BTC
          lowestPremium: 1.0,
          highestPremium: 1.5,
        },
        {
          strikePercent: 15,
          offers: [
            createOffer("12", 30_000_000, 2.0), // 0.3 BTC
            createOffer("13", 20_000_000, 1.75), // 0.2 BTC
          ],
          totalLiquiditySats: 50_000_000, // 0.5 BTC
          lowestPremium: 1.75,
          highestPremium: 2.0,
        },
      ],
    },
    {
      term: 14,
      expiryDate: new Date(now.getTime() + 14 * 86400000),
      strikes: [
        {
          strikePercent: 5,
          offers: [createOffer("17", 100_000_000, 1.5)], // 1 BTC
          totalLiquiditySats: 100_000_000,
          lowestPremium: 1.5,
          highestPremium: 1.5,
        },
        {
          strikePercent: 10,
          offers: [
            createOffer("18", 50_000_000, 2.0), // 0.5 BTC
            createOffer("19", 125_000_000, 2.25), // 1.25 BTC
          ],
          totalLiquiditySats: 175_000_000, // 1.75 BTC
          lowestPremium: 2.0,
          highestPremium: 2.25,
        },
        {
          strikePercent: 15,
          offers: [createOffer("20", 75_000_000, 2.5)], // 0.75 BTC
          totalLiquiditySats: 75_000_000,
          lowestPremium: 2.5,
          highestPremium: 2.5,
        },
      ],
    },
  ];

  return {
    termGroups,
  };
}

async function fetchOptions(): Promise<OptionsData> {
  await new Promise((resolve) => setTimeout(resolve, 100));
  return generateMockOptionsData();
}

export function useOptions() {
  return useQuery({
    queryKey: ["options"],
    queryFn: fetchOptions,
    staleTime: 30000, // 30 seconds
  });
}

export function findBestOffer(
  data: OptionsData | undefined,
  term: number,
  strikePercent: number,
  amountSats: number,
): OptionOffer | null {
  if (!data) return null;

  const termGroup = data.termGroups.find((g) => g.term === term);
  if (!termGroup) return null;

  const strikeBucket = termGroup.strikes.find((s) => s.strikePercent === strikePercent);
  if (!strikeBucket) return null;

  const sortedOffers = [...strikeBucket.offers].sort((a, b) => {
    if (a.premium !== b.premium) return a.premium - b.premium;
    return a.createdAt.getTime() - b.createdAt.getTime();
  });

  return sortedOffers.find((offer) => offer.amountSats >= amountSats) ?? null;
}

export function getMaxLiquiditySats(
  data: OptionsData | undefined,
  term: number,
  strikePercent: number,
): number {
  if (!data) return 0;

  const termGroup = data.termGroups.find((g) => g.term === term);
  if (!termGroup) return 0;

  const strikeBucket = termGroup.strikes.find((s) => s.strikePercent === strikePercent);
  if (!strikeBucket || strikeBucket.offers.length === 0) return 0;

  return Math.max(...strikeBucket.offers.map((o) => o.amountSats));
}

export function getStrikePercentsForTerm(data: OptionsData | undefined, term: number): number[] {
  if (!data) return [];

  const termGroup = data.termGroups.find((g) => g.term === term);
  if (!termGroup) return [];

  return termGroup.strikes.map((s) => s.strikePercent);
}
