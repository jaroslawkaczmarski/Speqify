import type { EmailMessage } from "./types.js";

interface InvitationArgs {
  reviewerName: string;
  reviewerEmail: string;
  projectName: string;
  sessionName: string;
  /** Plain text PO blurb shown in the email (sender-provided, untrusted). */
  description: string;
  inviteUrl: string;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Single-template invitation. Plain HTML, inline styles, dark-mode-aware. */
export function buildInvitationEmail(a: InvitationArgs): EmailMessage {
  const subject = `Zaproszenie do sesji review · ${a.projectName}`;
  const greetingName = a.reviewerName.trim().split(/\s+/)[0] ?? "";
  const descriptionBlock = a.description.trim()
    ? `<p style="margin:0 0 16px;color:#475569;line-height:1.55;">${escapeHtml(a.description)}</p>`
    : "";

  const html = `<!doctype html>
<html lang="pl">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <meta name="color-scheme" content="light dark" />
    <meta name="supported-color-schemes" content="light dark" />
    <title>${escapeHtml(subject)}</title>
  </head>
  <body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:14px;box-shadow:0 1px 2px rgba(15,23,42,0.06);overflow:hidden;">
            <tr>
              <td style="padding:28px 28px 8px;">
                <div style="font-size:13px;letter-spacing:0.08em;color:#94a3b8;text-transform:uppercase;font-weight:600;">Speqify · review session</div>
                <h1 style="margin:8px 0 4px;font-size:22px;line-height:1.3;color:#0f172a;">Cześć ${escapeHtml(greetingName)}!</h1>
                <p style="margin:0 0 16px;color:#334155;line-height:1.55;">
                  Zostałeś zaproszony jako reviewer do sesji
                  <strong>${escapeHtml(a.sessionName)}</strong>
                  w projekcie <strong>${escapeHtml(a.projectName)}</strong>.
                </p>
                ${descriptionBlock}
                <p style="margin:24px 0 8px;text-align:center;">
                  <a href="${escapeHtml(a.inviteUrl)}" style="display:inline-block;background:#0f172a;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:600;font-size:15px;">
                    Otwórz sesję review
                  </a>
                </p>
                <p style="margin:16px 0 0;color:#64748b;font-size:13px;line-height:1.5;">
                  Link jest osobisty — nie udostępniaj go nikomu. Jeśli przycisk nie działa, skopiuj adres:<br />
                  <span style="word-break:break-all;color:#0f172a;">${escapeHtml(a.inviteUrl)}</span>
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:0 28px 28px;color:#94a3b8;font-size:12px;line-height:1.5;">
                Wysłane do ${escapeHtml(a.reviewerEmail)} · Speqify.app
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  const text = [
    `Cześć ${greetingName}!`,
    "",
    `Zostałeś zaproszony jako reviewer do sesji „${a.sessionName}” w projekcie „${a.projectName}”.`,
    a.description.trim() ? "" : null,
    a.description.trim() || null,
    "",
    `Otwórz sesję: ${a.inviteUrl}`,
    "",
    "Link jest osobisty — nie udostępniaj go.",
    "",
    "Speqify.app",
  ]
    .filter((line): line is string => line !== null)
    .join("\n");

  return { to: a.reviewerEmail, toName: a.reviewerName, subject, html, text };
}
