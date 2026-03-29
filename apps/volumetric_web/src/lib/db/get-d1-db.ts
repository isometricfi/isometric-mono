import "server-only";
import type { D1Database } from "@cloudflare/workers-types";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { type DrizzleD1Database, drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

interface CloudflareEnv {
  DB?: D1Database;
}

let dbInstance: DrizzleD1Database<typeof schema> | null = null;

export function getD1Db(): DrizzleD1Database<typeof schema> {
  if (dbInstance) {
    return dbInstance;
  }

  const { env } = getCloudflareContext();
  const cloudflareEnv = env as CloudflareEnv;

  if (!cloudflareEnv.DB) {
    throw new Error("Missing Cloudflare D1 binding: DB");
  }

  dbInstance = drizzle(cloudflareEnv.DB, { schema });
  return dbInstance;
}
