import type { StoredXrcBtcUsdRate } from "@volumetric/canister-types";
import { getCanisterActor } from "@/lib/canister-server";
import { getXrcSnapshotRepository } from "@/lib/repositories/xrc-snapshot/get-xrc-snapshot-repository";
import type { IXrcSnapshotRepository } from "@/lib/repositories/xrc-snapshot/xrc-snapshot-repository.interface";
import { logError } from "@/lib/telemetry/logs";
import { withSpan } from "@/lib/telemetry/withSpan";
import { type Output, outputSchema, parseLatestPersistedXrcTimestampSeconds } from "./schema";

const SYNC_XRC_PRICE_SPAN_NAME = "usecase.market.sync_xrc_price_from_canister";
const MILLISECONDS_PER_SECOND = 1_000;
const STALE_CANISTER_CACHE_ALERT_THRESHOLD_30_MINUTES_MS = 30 * 60 * 1_000;

interface SyncXrcPriceFromCanisterDependencies {
  getActor?: typeof getCanisterActor;
  repository?: IXrcSnapshotRepository;
}

async function alertIfCanisterCacheStale(rate: StoredXrcBtcUsdRate): Promise<void> {
  const xrcTimestampMs = Number(rate.xrc_timestamp_seconds) * MILLISECONDS_PER_SECOND;
  const cacheAgeMs = Date.now() - xrcTimestampMs;
  if (cacheAgeMs <= STALE_CANISTER_CACHE_ALERT_THRESHOLD_30_MINUTES_MS) {
    return;
  }

  await logError(
    `Canister XRC cache stale: xrcTimestampMs=${xrcTimestampMs} cacheAgeMs=${cacheAgeMs} thresholdMs=${STALE_CANISTER_CACHE_ALERT_THRESHOLD_30_MINUTES_MS}`,
  );
}

function storedRateToPersistedResponseJson(rate: StoredXrcBtcUsdRate): string {
  return JSON.stringify({
    source: "canister_stable_cache",
    xrc_timestamp_seconds: Number(rate.xrc_timestamp_seconds),
    fetched_at_seconds: Number(rate.fetched_at_seconds),
    price_cents: Number(rate.price_cents),
    decimals: rate.decimals,
  });
}

export async function syncXrcPriceFromCanister(
  dependencies: SyncXrcPriceFromCanisterDependencies = {},
): Promise<Output> {
  return withSpan(SYNC_XRC_PRICE_SPAN_NAME, async () => {
    const getActor = dependencies.getActor ?? getCanisterActor;
    const repository = dependencies.repository ?? getXrcSnapshotRepository();

    const actor = await getActor();
    const [latestRate] = await actor.get_latest_xrc_btc_usd_rate();

    if (!latestRate) {
      return outputSchema.parse({
        success: true,
        inserted: false,
        skippedReason: "empty_canister_cache",
      });
    }

    await alertIfCanisterCacheStale(latestRate);

    const candidateXrcTimestampSeconds = Number(latestRate.xrc_timestamp_seconds);
    const latestJson = await repository.getLatestSnapshotResponseJson();
    const latestPersistedXrcTimestampSeconds = parseLatestPersistedXrcTimestampSeconds(latestJson);

    if (
      latestPersistedXrcTimestampSeconds !== null &&
      latestPersistedXrcTimestampSeconds === candidateXrcTimestampSeconds
    ) {
      return outputSchema.parse({
        success: true,
        inserted: false,
        skippedReason: "duplicate_xrc_timestamp",
      });
    }

    const fetchedAtMs = Number(latestRate.fetched_at_seconds) * MILLISECONDS_PER_SECOND;
    await repository.insertSnapshot({
      fetchedAtMs,
      responseJson: storedRateToPersistedResponseJson(latestRate),
    });

    return outputSchema.parse({
      success: true,
      inserted: true,
    });
  });
}
