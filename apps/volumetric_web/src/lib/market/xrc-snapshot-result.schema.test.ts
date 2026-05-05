import type { Result_6 } from "@volumetric/canister-types";
import { describe, expect, test } from "vitest";

import {
  parseXrcSnapshotResultJson,
  stringifyXrcSnapshotResult,
} from "./xrc-snapshot-result.schema";

describe("xrc snapshot JSON round-trip", () => {
  test("should parse stored JSON after stringify for an Ok XRC payload", () => {
    // given
    const inner: Result_6 = {
      Ok: {
        metadata: {
          decimals: 9,
          forex_timestamp: [],
          quote_asset_num_received_rates: BigInt(4),
          base_asset_num_received_rates: BigInt(4),
          base_asset_num_queried_sources: BigInt(4),
          standard_deviation: BigInt(0),
          quote_asset_num_queried_sources: BigInt(4),
        },
        rate: BigInt(95_000_000_000_000),
        timestamp: BigInt(1_749_456_900),
        quote_asset: {
          class: { FiatCurrency: null },
          symbol: "USD",
        },
        base_asset: {
          class: { Cryptocurrency: null },
          symbol: "BTC",
        },
      },
    };

    // when
    const json = stringifyXrcSnapshotResult(inner);
    const parsed = parseXrcSnapshotResultJson(json);

    // then
    expect(parsed).toEqual(inner);
  });
});
