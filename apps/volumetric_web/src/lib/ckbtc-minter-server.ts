export type RetrieveBtcStatusV2 =
  | { Signing: null }
  | { Confirmed: { txid: Uint8Array | number[] } }
  | { Sending: { txid: Uint8Array | number[] } }
  | { Submitted: { txid: Uint8Array | number[] } }
  | { Pending: null }
  | { Unknown: null }
  | { AmountTooLow: null }
  | { WillReimburse: unknown }
  | { Reimbursed: unknown };

export interface CkbtcMinterService {
  retrieve_btc_status_v2: (arg: { block_index: bigint }) => Promise<RetrieveBtcStatusV2>;
}

export async function getCkbtcMinterActor(): Promise<CkbtcMinterService> {
  throw new Error("ckBTC minter calls are disabled in demo mode");
}

export function bytesToHex(bytes: Uint8Array | number[]): string {
  const arr = bytes instanceof Uint8Array ? bytes : Uint8Array.from(bytes);
  return Array.from(arr)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function bitcoinTxidBlobToExplorerHex(bytes: Uint8Array | number[]): string {
  const arr = bytes instanceof Uint8Array ? bytes : Uint8Array.from(bytes);
  const reversed = new Uint8Array(arr.length);
  for (let i = 0; i < arr.length; i += 1) {
    reversed[i] = arr[arr.length - 1 - i]!;
  }
  return bytesToHex(reversed);
}
