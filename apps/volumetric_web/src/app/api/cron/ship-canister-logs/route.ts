import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { getD1Db } from "@/lib/db/get-d1-db";
import { canisterLogShipCursor } from "@/lib/db/schema";
import { logError, logInfo } from "@/lib/telemetry/logs";
import {
  createCronErrorResponse,
  createCronSuccessResponse,
  getCronAuthGuardResponse,
} from "../_lib/schemas";

const CANISTER_LOG_SERVICE_NAME_SUFFIX = "-canister";
const FALLBACK_CANISTER_LOG_SERVICE_NAME = "volumetric-canister";
const INITIAL_SINCE_SECONDS = 0;
const CURSOR_LOOKBACK_SECONDS = 5 * 60;
const DEFAULT_LOG_LIMIT = 5000;
const RAW_IC_GATEWAY_DOMAIN = "raw.icp0.io";
const CANISTER_LOG_SHIP_CURSOR_DOC_ID = "cursor";

const canisterLogEntrySchema = z.object({
  timestamp: z.number(),
  priority: z.enum(["DEBUG", "INFO", "WARN", "ERROR"]),
  file: z.string(),
  line: z.number(),
  message: z.string(),
  counter: z.number(),
});

const canisterLogsResponseSchema = z.object({
  logs: z.array(canisterLogEntrySchema),
  limit: z.number(),
  offset: z.number(),
});

const shipCanisterLogsSuccessSchema = z.object({
  success: z.literal(true),
  fetchedCount: z.number(),
  shippedCount: z.number(),
});

type CanisterLogEntry = z.infer<typeof canisterLogEntrySchema>;

interface ShipCursor {
  timestampSeconds: number;
  counter: number;
}

export async function GET(request: Request) {
  const guardResponse = getCronAuthGuardResponse(request);
  if (guardResponse) {
    return guardResponse;
  }

  try {
    const cursor = await readShipCursor();
    const sinceSeconds = resolveSinceSeconds(cursor);
    const fetchedLogs = await fetchCanisterLogs(sinceSeconds);
    const newLogs = filterAndSortNewLogs(fetchedLogs, cursor);

    await shipCanisterLogs(newLogs);

    const nextCursor = resolveNextCursor(cursor, fetchedLogs, newLogs);
    if (nextCursor !== null) {
      await writeShipCursor(nextCursor);
    }

    return createCronSuccessResponse(shipCanisterLogsSuccessSchema, {
      success: true,
      fetchedCount: fetchedLogs.length,
      shippedCount: newLogs.length,
    });
  } catch (error) {
    await logError("Failed to ship canister logs", error);
    return createCronErrorResponse("Failed to ship canister logs", 500);
  }
}

async function fetchCanisterLogs(sinceSeconds: number): Promise<CanisterLogEntry[]> {
  const canisterLogAccessToken = requireEnv("CANISTER_LOG_ACCESS_TOKEN");
  const canisterLogsUrl = buildCanisterLogsUrl(sinceSeconds);

  const response = await fetch(canisterLogsUrl, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${canisterLogAccessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`canister logs request failed: ${response.status} ${response.statusText}`);
  }

  const payload = canisterLogsResponseSchema.parse(await response.json());
  return payload.logs;
}

function filterAndSortNewLogs(
  logs: CanisterLogEntry[],
  cursor: ShipCursor | null,
): CanisterLogEntry[] {
  const filtered = cursor === null ? logs : logs.filter((entry) => isAfterCursor(entry, cursor));
  return filtered.sort(compareLogEntries);
}

function isAfterCursor(entry: CanisterLogEntry, cursor: ShipCursor): boolean {
  if (entry.timestamp > cursor.timestampSeconds) {
    return true;
  }
  if (entry.timestamp < cursor.timestampSeconds) {
    return false;
  }
  return entry.counter > cursor.counter;
}

function compareLogEntries(a: CanisterLogEntry, b: CanisterLogEntry): number {
  if (a.timestamp !== b.timestamp) {
    return a.timestamp - b.timestamp;
  }
  return a.counter - b.counter;
}

async function shipCanisterLogs(logs: CanisterLogEntry[]): Promise<void> {
  const logOptions = { serviceName: resolveCanisterLogServiceName() };
  for (const logEntry of logs) {
    const message = formatCanisterLogEntry(logEntry);
    if (logEntry.priority === "ERROR") {
      await logError(message, undefined, logOptions);
      continue;
    }

    await logInfo(message, logOptions);
  }
}

async function readShipCursor(): Promise<ShipCursor | null> {
  const rows = await getD1Db()
    .select({
      timestampSeconds: canisterLogShipCursor.lastShippedTimestampSeconds,
      counter: canisterLogShipCursor.lastShippedCounter,
    })
    .from(canisterLogShipCursor)
    .where(eq(canisterLogShipCursor.id, CANISTER_LOG_SHIP_CURSOR_DOC_ID))
    .limit(1);

  const row = rows[0];
  if (!row) {
    return null;
  }

  return {
    timestampSeconds: row.timestampSeconds,
    counter: row.counter,
  };
}

async function writeShipCursor(cursor: ShipCursor): Promise<void> {
  await getD1Db()
    .insert(canisterLogShipCursor)
    .values({
      id: CANISTER_LOG_SHIP_CURSOR_DOC_ID,
      lastShippedTimestampSeconds: cursor.timestampSeconds,
      lastShippedCounter: cursor.counter,
      updatedAtMs: Date.now(),
    })
    .onConflictDoUpdate({
      target: canisterLogShipCursor.id,
      set: {
        lastShippedTimestampSeconds: sql`excluded.last_shipped_timestamp_seconds`,
        lastShippedCounter: sql`excluded.last_shipped_counter`,
        updatedAtMs: sql`excluded.updated_at_ms`,
      },
    });
}

function resolveSinceSeconds(cursor: ShipCursor | null): number {
  if (cursor === null) {
    return INITIAL_SINCE_SECONDS;
  }

  return Math.max(0, cursor.timestampSeconds - CURSOR_LOOKBACK_SECONDS);
}

function resolveNextCursor(
  _currentCursor: ShipCursor | null,
  _fetchedLogs: CanisterLogEntry[],
  shippedLogs: CanisterLogEntry[],
): ShipCursor | null {
  if (shippedLogs.length === 0) {
    return null;
  }

  const latest = shippedLogs[shippedLogs.length - 1];
  return { timestampSeconds: latest.timestamp, counter: latest.counter };
}

function buildCanisterLogsUrl(sinceSeconds: number): string {
  const canisterId = requireEnv("CANISTER_ID");
  const url = new URL("/logs", `https://${canisterId}.${RAW_IC_GATEWAY_DOMAIN}`);

  url.searchParams.set("debug", "true");
  url.searchParams.set("time", sinceSeconds.toString());
  url.searchParams.set("limit", DEFAULT_LOG_LIMIT.toString());

  return url.toString();
}

function formatCanisterLogEntry(logEntry: CanisterLogEntry): string {
  return JSON.stringify({
    source: "volumetric_canister",
    timestamp: logEntry.timestamp,
    priority: logEntry.priority,
    file: logEntry.file,
    line: logEntry.line,
    counter: logEntry.counter,
    message: logEntry.message,
  });
}

function resolveCanisterLogServiceName(): string {
  const webServiceName = process.env.OTEL_SERVICE_NAME?.trim();
  if (!webServiceName) {
    return FALLBACK_CANISTER_LOG_SERVICE_NAME;
  }

  return `${webServiceName}${CANISTER_LOG_SERVICE_NAME_SUFFIX}`;
}

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required`);
  }

  return value;
}
