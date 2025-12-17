export interface OptionOffer {
  id: string;
  writerId: string;
  amountSats: number;
  premium: number;
  strikePercent: number;
  termDays: number;
  createdAt: string;
  expiresAt: string;
}

export interface StrikeBucket {
  strikePercent: number;
  offers: OptionOffer[];
  totalLiquiditySats: number;
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
