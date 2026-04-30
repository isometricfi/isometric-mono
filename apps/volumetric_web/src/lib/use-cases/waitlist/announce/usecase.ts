import "server-only";

import { Resend } from "resend";
import { renderWaitlistAnnouncement } from "@/lib/email/templates/waitlist-announcement";
import { logError, logInfo } from "@/lib/telemetry/logs";

const FROM_ADDRESS = "Isometric <noreply@isometric.fi>";
const UNSUBSCRIBE_MAILTO = "unsubscribe@isometric.fi";
const RESEND_BATCH_LIMIT = 100;

export interface AnnounceInput {
  emails: string[];
  appUrl: string;
  dryRun?: boolean;
}

export interface AnnounceResult {
  totalRequested: number;
  uniqueRecipients: number;
  sent: number;
  failed: number;
  dryRun: boolean;
}

export async function sendWaitlistAnnouncement(input: AnnounceInput): Promise<AnnounceResult> {
  const recipients = normaliseEmails(input.emails);
  const dryRun = input.dryRun ?? false;

  const result: AnnounceResult = {
    totalRequested: input.emails.length,
    uniqueRecipients: recipients.length,
    sent: 0,
    failed: 0,
    dryRun,
  };

  if (recipients.length === 0) {
    return result;
  }

  const { subject, html, text } = renderWaitlistAnnouncement({ appUrl: input.appUrl });

  if (dryRun) {
    await logInfo(`Waitlist announcement dry run: would send to ${recipients.length} recipients`);
    return result;
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not configured");
  }

  const resend = new Resend(apiKey);

  for (let i = 0; i < recipients.length; i += RESEND_BATCH_LIMIT) {
    const batch = recipients.slice(i, i + RESEND_BATCH_LIMIT);

    const payload = batch.map((email) => ({
      from: FROM_ADDRESS,
      to: email,
      subject,
      html,
      text,
      headers: {
        "List-Unsubscribe": `<mailto:${UNSUBSCRIBE_MAILTO}?subject=unsubscribe>`,
      },
    }));

    try {
      const response = await resend.batch.send(payload);
      if (response.error) {
        result.failed += batch.length;
        await logError("Resend batch returned error", response.error);
      } else {
        result.sent += batch.length;
      }
    } catch (error) {
      result.failed += batch.length;
      await logError("Failed to send waitlist announcement batch", error);
    }
  }

  await logInfo(
    `Waitlist announcement sent: ${result.sent}/${recipients.length} (${result.failed} failed)`,
  );

  return result;
}

function normaliseEmails(emails: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of emails) {
    const trimmed = raw.trim().toLowerCase();
    if (!trimmed) continue;
    if (seen.has(trimmed)) continue;
    seen.add(trimmed);
    result.push(trimmed);
  }
  return result;
}
