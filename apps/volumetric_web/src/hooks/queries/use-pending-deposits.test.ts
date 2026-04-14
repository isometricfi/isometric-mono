import { describe, expect, test } from "vitest";
import { buildPendingDeposits } from "./use-pending-deposits";

const TEST_DEPOSIT_ADDRESS = "bc1qdeposit";

describe("buildPendingDeposits", () => {
  test("should show unconfirmed mempool deposit immediately", () => {
    // given
    const mempoolTxs = [
      {
        txid: "tx-unconfirmed",
        status: { confirmed: false },
        vout: [{ scriptpubkey_address: TEST_DEPOSIT_ADDRESS, value: 7_026 }],
      },
    ];

    // when
    const result = buildPendingDeposits({
      mempoolTxs,
      serverPendingDeposits: [],
      depositAddress: TEST_DEPOSIT_ADDRESS,
    });

    // then
    expect(result).toEqual([
      {
        txid: "tx-unconfirmed",
        vout: 0,
        valueSats: 7_026,
        confirmations: 0,
        status: "unconfirmed",
      },
    ]);
  });

  test("should show backend pending deposit as confirming before four confirmations", () => {
    // given
    // when
    const result = buildPendingDeposits({
      mempoolTxs: [],
      serverPendingDeposits: [
        { txid: "tx-confirming", vout: 0, valueSats: 7_028, confirmations: 2 },
      ],
      depositAddress: TEST_DEPOSIT_ADDRESS,
    });

    // then
    expect(result).toEqual([
      {
        txid: "tx-confirming",
        vout: 0,
        valueSats: 7_028,
        confirmations: 2,
        status: "confirming",
      },
    ]);
  });

  test("should show backend pending deposit as processing at or above four confirmations", () => {
    // when
    const result = buildPendingDeposits({
      mempoolTxs: [],
      serverPendingDeposits: [
        { txid: "tx-processing", vout: 0, valueSats: 7_028, confirmations: 4 },
      ],
      depositAddress: TEST_DEPOSIT_ADDRESS,
    });

    // then
    expect(result).toEqual([
      {
        txid: "tx-processing",
        vout: 0,
        valueSats: 7_028,
        confirmations: 4,
        status: "processing",
      },
    ]);
  });
});
