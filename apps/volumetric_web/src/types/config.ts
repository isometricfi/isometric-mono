export interface FeeConfig {
  premiumFeeBasisPoints: bigint;
  profitFeeBasisPoints: bigint;
  feeRecipient: string;
}

export interface ConfigData {
  canisterId: string | undefined;
  icHost: string;
  termOptions: number[];
  strikePercentOptions: number[];
  premium: {
    min: number;
    max: number;
    step: number;
  };
  minOfferAmountSats: number;
  maxOfferAmountSats: number;
  minDepositAmountSats: number;
  minWithdrawAmountSats: number;
  minTermDays: number;
  maxTermDays: number;
  fees: FeeConfig;
}
