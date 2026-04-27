import { Principal } from "@dfinity/principal";
import type { AuditExpectedTransfer, OptionAuditReport } from "@volumetric/canister-types";
import { describe, expect, test } from "vitest";

import { defaultAccount } from "./account";
import {
  buildExpectedTransferRows,
  type ExpectedTransferAuditRow,
  sumIncomingTransfers,
} from "./audit";
import type { AccountTransaction } from "./ckbtc-index";

const FEE_RECIPIENT = Principal.fromText(
  "a6nyt-23cn7-g5zvc-pxir2-dfi7d-z726j-vz4ky-ds6a2-2a4rb-6g7kp-7qe",
);
const PROTOCOL_CANISTER = Principal.fromText("5optx-3iaaa-aaaae-qjwsa-cai");
const OTHER_CANISTER = Principal.fromText("4dqqd-aqaaa-aaaae-qgbta-cai");
const EXPECTED_AMOUNT_SATS = 26n;
const EXPECTED_MEMO = Uint8Array.from([1, 2, 3, 4]);

describe("audit mappers", () => {
  test("should sum only incoming transfers from known protocol canisters", () => {
    // given
    const transactions = [
      makeTransaction({
        id: 1n,
        amount: EXPECTED_AMOUNT_SATS,
        from: PROTOCOL_CANISTER,
        to: FEE_RECIPIENT,
        memo: EXPECTED_MEMO,
      }),
      makeTransaction({
        id: 2n,
        amount: 5_350n,
        from: OTHER_CANISTER,
        to: FEE_RECIPIENT,
        memo: EXPECTED_MEMO,
      }),
      makeTransaction({
        id: 3n,
        amount: 999n,
        from: FEE_RECIPIENT,
        to: PROTOCOL_CANISTER,
        memo: EXPECTED_MEMO,
      }),
    ];

    // when
    const total = sumIncomingTransfers({
      transactions,
      toOwner: FEE_RECIPIENT.toText(),
      fromOwners: [PROTOCOL_CANISTER.toText(), OTHER_CANISTER.toText()],
    });

    // then
    const EXPECTED_TOTAL_SATS = 5_376n;
    expect(total).toBe(EXPECTED_TOTAL_SATS);
  });

  test("should mark an expected transfer as matched when amount accounts and memo match", () => {
    // given
    const expectedTransfer = makeExpectedTransfer();
    const report = makeReport([expectedTransfer]);
    const transactions = [
      makeTransaction({
        id: 3_576_566n,
        amount: expectedTransfer.amount_sats,
        from: expectedTransfer.from.owner,
        to: expectedTransfer.to.owner,
        memo: new Uint8Array(expectedTransfer.memo),
      }),
    ];

    // when
    const rows = buildExpectedTransferRows(report, transactions);

    // then
    const [row] = rows as [ExpectedTransferAuditRow];
    expect(row.status).toBe("matched");
    expect(row.matchedTransactionIds).toEqual([3_576_566n]);
  });

  test("should mark an expected transfer as missing when memo does not match", () => {
    // given
    const expectedTransfer = makeExpectedTransfer();
    const report = makeReport([expectedTransfer]);
    const transactions = [
      makeTransaction({
        id: 3_576_566n,
        amount: expectedTransfer.amount_sats,
        from: expectedTransfer.from.owner,
        to: expectedTransfer.to.owner,
        memo: Uint8Array.from([9, 9, 9]),
      }),
    ];

    // when
    const rows = buildExpectedTransferRows(report, transactions);

    // then
    const [row] = rows as [ExpectedTransferAuditRow];
    expect(row.status).toBe("missing");
    expect(row.matchedTransactionIds).toEqual([]);
  });
});

function makeExpectedTransfer(): AuditExpectedTransfer {
  return {
    to: defaultAccount(FEE_RECIPIENT),
    created_at_time_ns: 1_777_287_773_998_245_920n,
    from: defaultAccount(PROTOCOL_CANISTER),
    kind: { SettlementProfitFee: null },
    memo: EXPECTED_MEMO,
    note: "test transfer",
    operation_id: Uint8Array.from([8, 7, 6]),
    amount_sats: EXPECTED_AMOUNT_SATS,
  };
}

function makeReport(expectedTransfers: AuditExpectedTransfer[]): OptionAuditReport {
  return {
    writer_balance: [],
    option: [],
    option_events: [],
    expected_transfers: expectedTransfers,
    option_id: 1n,
    buyer_balance: [],
    settlement: [],
  };
}

function makeTransaction({
  id,
  amount,
  from,
  to,
  memo,
}: {
  id: bigint;
  amount: bigint;
  from: Principal;
  to: Principal;
  memo: Uint8Array;
}): AccountTransaction {
  return {
    id,
    transaction: {
      burn: [],
      kind: "transfer",
      mint: [],
      approve: [],
      fee_collector: [],
      timestamp: 1_777_287_781_858_218_497n,
      transfer: [
        {
          to: defaultAccount(to),
          fee: [10n],
          from: defaultAccount(from),
          memo: [memo],
          created_at_time: [1_777_287_773_998_245_920n],
          amount,
          spender: [],
        },
      ],
    },
  };
}
