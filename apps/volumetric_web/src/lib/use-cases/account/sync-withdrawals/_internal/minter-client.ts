import {
  bytesToHex,
  getCkbtcMinterActor,
  type RetrieveBtcStatusV2,
} from "@/lib/ckbtc-minter-server";

export type MinterResolution =
  | { kind: "txid"; txid: string }
  | { kind: "pending" }
  | { kind: "failed"; reason: string };

export async function resolveBitcoinTxidFromMinter(blockIndex: number): Promise<MinterResolution> {
  const minter = await getCkbtcMinterActor();
  const status: RetrieveBtcStatusV2 = await minter.retrieve_btc_status_v2({
    block_index: BigInt(blockIndex),
  });

  if ("Confirmed" in status) {
    return { kind: "txid", txid: bytesToHex(status.Confirmed.txid) };
  }
  if ("Sending" in status) {
    return { kind: "txid", txid: bytesToHex(status.Sending.txid) };
  }
  if ("Submitted" in status) {
    return { kind: "txid", txid: bytesToHex(status.Submitted.txid) };
  }
  if ("AmountTooLow" in status) {
    return { kind: "failed", reason: "amount too low" };
  }
  if ("WillReimburse" in status || "Reimbursed" in status) {
    return { kind: "failed", reason: "minter is reimbursing the burn" };
  }
  return { kind: "pending" };
}
