export interface WaitlistAnnouncementTemplate {
  subject: string;
  html: string;
  text: string;
}

export interface WaitlistAnnouncementOptions {
  appUrl?: string;
  logoUrl?: string;
}

const DEFAULT_APP_URL = "https://isometric.fi";
const DEFAULT_LOGO_URL = "https://isometric.fi/apple-icon.png";

const COLORS = {
  background: "#fbf7f0",
  card: "#ffffff",
  border: "#e8ddcd",
  foreground: "#2c241e",
  muted: "#7d736a",
  subtle: "#a89c8f",
  primary: "#e35d36",
  primaryForeground: "#ffffff",
  badgeBackground: "#fbe8da",
  badgeForeground: "#a8401b",
};

const FONT_STACK =
  "'Sora', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

export function renderWaitlistAnnouncement(
  options: WaitlistAnnouncementOptions = {},
): WaitlistAnnouncementTemplate {
  const appUrl = options.appUrl ?? DEFAULT_APP_URL;
  const logoUrl = options.logoUrl ?? DEFAULT_LOGO_URL;

  const subject = "Isometric is live in public beta";

  const text = [
    "Isometric is live.",
    "",
    "Bitcoin options. For everyone.",
    "",
    "Earn yield on your BTC, or leverage its next move. Fully on-chain. Self-custody. No KYC.",
    "",
    `Open the app: ${appUrl}`,
    "",
    "Reach out to support@isometric.fi if you have any questions or suggestions. We would love to hear your feedback.",
    "",
    "Unsubscribe: mailto:unsubscribe@isometric.fi?subject=unsubscribe",
  ].join("\n");

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="light" />
    <meta name="supported-color-schemes" content="light" />
    <title>${subject}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link href="https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700&display=swap" rel="stylesheet" />
  </head>
  <body style="margin:0;padding:0;background:${COLORS.background};font-family:${FONT_STACK};color:${COLORS.foreground};-webkit-font-smoothing:antialiased;letter-spacing:-0.005em;">
    <span style="display:none!important;visibility:hidden;opacity:0;height:0;width:0;font-size:1px;line-height:1px;mso-hide:all;">
      Bitcoin options. For everyone. Public beta is live.
    </span>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${COLORS.background};">
      <tr>
        <td align="center" style="padding:48px 16px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;background:${COLORS.card};border:1px solid ${COLORS.border};border-radius:14px;overflow:hidden;">
            <tr>
              <td style="padding:32px 32px 0 32px;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td style="vertical-align:middle;padding-right:12px;">
                      <img src="${logoUrl}" width="40" height="40" alt="Isometric" style="display:block;border-radius:8px;" />
                    </td>
                    <td style="vertical-align:middle;font-family:${FONT_STACK};font-size:17px;font-weight:600;letter-spacing:-0.01em;color:${COLORS.foreground};">
                      Isometric
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:28px 32px 12px 32px;">
                <span style="display:inline-block;background:${COLORS.badgeBackground};color:${COLORS.badgeForeground};font-family:${FONT_STACK};font-size:11px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;padding:5px 10px;border-radius:999px;">
                  Public Beta
                </span>
              </td>
            </tr>
            <tr>
              <td style="padding:0 32px 8px 32px;">
                <h1 style="margin:0;font-family:${FONT_STACK};font-size:32px;line-height:1.15;font-weight:700;letter-spacing:-0.025em;color:${COLORS.foreground};">
                  Isometric is live.
                </h1>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 32px 20px 32px;font-family:${FONT_STACK};font-size:18px;line-height:1.4;font-weight:500;color:${COLORS.primary};letter-spacing:-0.015em;">
                Bitcoin options. For everyone.
              </td>
            </tr>
            <tr>
              <td style="padding:0 32px 28px 32px;font-family:${FONT_STACK};font-size:15px;line-height:1.6;color:${COLORS.muted};">
                Earn yield on your BTC, or leverage its next move. Fully on-chain. Self-custody. No KYC.
              </td>
            </tr>
            <tr>
              <td style="padding:0 32px 36px 32px;">
                <a href="${appUrl}" style="display:inline-block;background:${COLORS.primary};color:${COLORS.primaryForeground};text-decoration:none;font-family:${FONT_STACK};font-weight:600;font-size:15px;letter-spacing:-0.01em;padding:13px 24px;border-radius:10px;">
                  Open App
                </a>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 32px 28px 32px;border-top:1px solid ${COLORS.border};font-family:${FONT_STACK};font-size:13px;line-height:1.6;color:${COLORS.muted};">
                Reach out to <a href="mailto:support@isometric.fi" style="color:${COLORS.primary};text-decoration:none;">support@isometric.fi</a> if you have any questions or suggestions. We would love to hear your feedback.
              </td>
            </tr>
          </table>
          <div style="max-width:520px;margin:18px auto 0;font-family:${FONT_STACK};font-size:11px;line-height:1.5;color:${COLORS.subtle};text-align:center;">
            You're receiving this because you signed up at isometric.fi.<br />
            <a href="mailto:unsubscribe@isometric.fi?subject=unsubscribe" style="color:${COLORS.subtle};text-decoration:underline;">Unsubscribe</a>
          </div>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  return { subject, html, text };
}
