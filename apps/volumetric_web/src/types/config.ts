export interface ConfigData {
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
}
