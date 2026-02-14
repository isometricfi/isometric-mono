import { Resend } from "resend";
import type { Input, Output } from "./schema";

type SupportEmailConfig = {
  fromEmail: string;
  toEmail: string;
};

function getResendClient(): Resend {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY environment variable is not set");
  }
  return new Resend(apiKey);
}

function getSupportEmailConfig(): SupportEmailConfig {
  const fromEmail = process.env.SUPPORT_FROM_EMAIL;
  const toEmail = process.env.SUPPORT_TO_EMAIL;

  if (!fromEmail) {
    throw new Error("SUPPORT_FROM_EMAIL environment variable is not set");
  }

  if (!toEmail) {
    throw new Error("SUPPORT_TO_EMAIL environment variable is not set");
  }

  return {
    fromEmail,
    toEmail,
  };
}

export async function submitTicket(input: Input): Promise<Output> {
  const ticketId = `ISM-${Date.now().toString(36).toUpperCase()}`;

  const subjectLine =
    input.subject === "Other" && input.customSubject ? input.customSubject : input.subject;

  const emailSubject = `[Support Ticket ${ticketId}] ${subjectLine}`;

  const emailBody = `
## Support Ticket

**Ticket ID:** ${ticketId}
**Subject:** ${subjectLine}
**User Email:** ${input.email}
**User Wallet:** ${input.walletAddress}
**User ID:** ${input.userId}
**Submitted:** ${new Date().toISOString()}

---

### Message

${input.message}

---

*This ticket was submitted via the Isometric support form.*
  `.trim();

  try {
    const { fromEmail, toEmail } = getSupportEmailConfig();
    const attachments = input.attachments?.map((att) => ({
      filename: att.filename,
      content: att.content,
      content_type: att.contentType,
    }));

    const { error } = await getResendClient().emails.send({
      from: fromEmail,
      to: toEmail,
      replyTo: input.email,
      subject: emailSubject,
      text: emailBody,
      attachments,
    });

    if (error) {
      console.error("Failed to send support email:", error);
      return {
        success: false,
        error: "Failed to send support ticket. Please try again.",
      };
    }

    return {
      success: true,
      ticketId,
    };
  } catch (err) {
    console.error("Error submitting support ticket:", err);
    return {
      success: false,
      error: "An unexpected error occurred. Please try again.",
    };
  }
}
