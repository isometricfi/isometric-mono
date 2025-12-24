import type { UtxoStatus } from "@volumetric/canister-types";
import { unwrapResult } from "@volumetric/canister-types";
import { z } from "zod";
import { createApiHandler } from "@/lib/api-handler";
import { getCanisterActor } from "@/lib/canister-server";

const RequestSchema = z.object({
  address: z.string().min(1),
});

export type UpdateCkbtcBalanceRequest = z.infer<typeof RequestSchema>;

type SerializedUtxo = {
  height: number;
  value: string;
  outpoint: {
    txid: string;
    vout: number;
  };
};

type SerializedUtxoStatus =
  | { ValueTooSmall: SerializedUtxo }
  | { Tainted: SerializedUtxo }
  | { Minted: { minted_amount: string; block_index: string; utxo: SerializedUtxo } }
  | { Checked: SerializedUtxo };

export type UpdateCkbtcBalanceResponse = SerializedUtxoStatus[];

function serializeUtxo(utxo: {
  height: number;
  value: bigint;
  outpoint: { txid: Uint8Array | number[]; vout: number };
}): SerializedUtxo {
  const txidBytes =
    utxo.outpoint.txid instanceof Uint8Array
      ? utxo.outpoint.txid
      : new Uint8Array(utxo.outpoint.txid);
  return {
    height: utxo.height,
    value: utxo.value.toString(),
    outpoint: {
      txid: Array.from(txidBytes)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join(""),
      vout: utxo.outpoint.vout,
    },
  };
}

function serializeUtxoStatus(status: UtxoStatus): SerializedUtxoStatus {
  if ("ValueTooSmall" in status) {
    return { ValueTooSmall: serializeUtxo(status.ValueTooSmall) };
  }
  if ("Tainted" in status) {
    return { Tainted: serializeUtxo(status.Tainted) };
  }
  if ("Minted" in status) {
    return {
      Minted: {
        minted_amount: status.Minted.minted_amount.toString(),
        block_index: status.Minted.block_index.toString(),
        utxo: serializeUtxo(status.Minted.utxo),
      },
    };
  }
  if ("Checked" in status) {
    return { Checked: serializeUtxo(status.Checked) };
  }
  throw new Error("Unknown UtxoStatus variant");
}

export const POST = createApiHandler(RequestSchema, async ({ address }) => {
  try {
    const actor = await getCanisterActor();
    const result = await actor.update_ckbtc_balance(address);
    const statuses = unwrapResult(result);
    return statuses.map(serializeUtxoStatus) satisfies UpdateCkbtcBalanceResponse;
  } catch (error) {
    console.error("Error updating ckBTC balance:", error);
    throw new Error("Failed to update ckBTC balance");
  }
});
