import type { Offer } from "@volumetric/canister-types";

export interface StrikeBucket {
  strikePercent: number;
  offers: Offer[];
  totalLiquiditySats: bigint;
  lowestPremium: number;
  highestPremium: number;
}

export interface TermGroup {
  term: number;
  expiryDate: string;
  strikes: StrikeBucket[];
}

export interface OptionsData {
  termGroups: TermGroup[];
}
