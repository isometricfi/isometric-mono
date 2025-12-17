export interface OptionOffer {
  id: string;
  writerId: string;
  amountSats: number;
  premium: number;
  createdAt: string;
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
