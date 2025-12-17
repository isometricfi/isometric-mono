export type OptionType = "call" | "put";

export type ViewerMode = "writer" | "buyer";

export interface OptionOffer {
  id: string;
  writerId: string;
  amountSats: number; // in sats
  premium: number; // percentage
  createdAt: Date;
}

export interface StrikeBucket {
  strikePercent: number; // strike as percentage above current price (e.g. 5 = 5% above)
  offers: OptionOffer[];
  totalLiquiditySats: number; // summed amount in sats
  lowestPremium: number;
  highestPremium: number;
}

export interface TermGroup {
  term: number;
  expiryDate: Date;
  strikes: StrikeBucket[];
}

export interface OptionsData {
  termGroups: TermGroup[];
}
