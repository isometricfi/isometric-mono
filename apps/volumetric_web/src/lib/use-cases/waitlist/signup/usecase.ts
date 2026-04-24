import { getD1Db } from "@/lib/db/get-d1-db";
import { waitlistSignups } from "@/lib/db/schema";
import type { Input, Output } from "./schema";

export async function signupForWaitlist(input: Input): Promise<Output> {
  const db = getD1Db();

  const result = await db
    .insert(waitlistSignups)
    .values({
      email: input.email,
      createdAtMs: Date.now(),
      locale: input.locale ?? null,
    })
    .onConflictDoNothing({ target: waitlistSignups.email })
    .returning({ email: waitlistSignups.email });

  return { ok: true, alreadySignedUp: result.length === 0 };
}
