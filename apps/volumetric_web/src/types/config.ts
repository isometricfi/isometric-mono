export interface FeeConfig {
  premiumFeeBasisPoints: bigint;
  profitFeeBasisPoints: bigint;
  feeRecipient: string;
}

export interface ConfigData {
  termOptions: number[];
  strikePercentOptions: number[];
  premium: {
    min: number;
    max: number;
    step: number;
  };
  minCreateOfferAmountSats: number;
  maxCreateOfferAmountSats: number;
  minAcceptOfferAmountSats: number;
  maxAcceptOfferAmountSats: number;
  minDepositAmountSats: number;
  minWithdrawAmountSats: number;
  minTermDays: number;
  maxTermDays: number;
  fees: FeeConfig;
}
