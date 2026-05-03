type BitcoinPaymentMessageSigner = {
  signMessage: (
    message: string,
    options: { addressType: "payment"; protocol: "ecdsa" },
  ) => Promise<string | undefined>;
};

export function signBitcoinPaymentMessage(wallet: BitcoinPaymentMessageSigner, message: string) {
  return wallet.signMessage(message, {
    addressType: "payment",
    protocol: "ecdsa",
  });
}
