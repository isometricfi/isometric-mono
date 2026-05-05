import { unwrapResult } from "@volumetric/canister-types";

import { getCanisterActor } from "@/lib/canister-server";
import {
  parseXrcSnapshotResultJson,
  stringifyXrcSnapshotResult,
} from "@/lib/market/xrc-snapshot-result.schema";
import { getXrcSnapshotRepository } from "@/lib/repositories/xrc-snapshot/get-xrc-snapshot-repository";
import type { IXrcSnapshotRepository } from "@/lib/repositories/xrc-snapshot/xrc-snapshot-repository.interface";
import { withSpan } from "@/lib/telemetry/withSpan";
import { type Output, outputSchema } from "./schema";

const SYNC_XRC_PRICE_SPAN_NAME = "usecase.market.sync_xrc_price";

interface Dependencies {
  repository?: IXrcSnapshotRepository;
  nowMs?: () => number;
  getActor?: typeof getCanisterActor;
}

export async function syncXrcPriceSnapshot(dependencies: Dependencies = {}): Promise<Output> {
  return withSpan(SYNC_XRC_PRICE_SPAN_NAME, async () => {
    const repository = dependencies.repository ?? getXrcSnapshotRepository();
    const nowMs = dependencies.nowMs?.() ?? Date.now();
    const getActor = dependencies.getActor ?? getCanisterActor;

    const actor = await getActor();
    const outer = await actor.fetch_xrc_btc_usd_exchange_rate_snapshot();

    const inner = unwrapResult(outer);
    const responseJson = stringifyXrcSnapshotResult(inner);
    parseXrcSnapshotResultJson(responseJson);

    const { id } = await repository.insertSnapshot({
      responseJson,
      fetchedAtMs: nowMs,
    });

    return outputSchema.parse({
      success: true,
      id,
      fetchedAtMs: nowMs,
    });
  });
}
