import type { EmailMessage, EmailResult, EmailSender } from "./types.js";

const RESEND_URL = "https://api.resend.com/emails";

interface ResendOpts {
  apiKey: string;
  /** Verified sender; the DNS records (SPF/DKIM) are configured manually
   *  at the Resend dashboard. Defaults to noreply@speqify.app per the
   *  product decision (RS-NOTES.md §RS-5). */
  from?: string;
  /** Optional Reply-To — the PO's email is a sensible default but we let
   *  the caller decide. */
  replyTo?: string;
}

/**
 * Resend transactional-email sender. Failures are returned as
 * `{ sent: false, reason }` — never thrown — so the invite flow can
 * surface the magic-link to the PO as a fallback (graceful-degradation
 * is the contract per RS-NOTES.md §RS-5).
 */
export class ResendSender implements EmailSender {
  constructor(private readonly opts: ResendOpts) {}

  async send(msg: EmailMessage): Promise<EmailResult> {
    const from = this.opts.from ?? "Speqify <noreply@speqify.app>";
    try {
      const res = await fetch(RESEND_URL, {
        method: "POST",
        headers: {
          authorization: `Bearer ${this.opts.apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          from,
          to: [msg.toName ? `${msg.toName} <${msg.to}>` : msg.to],
          subject: msg.subject,
          html: msg.html,
          text: msg.text,
          ...(this.opts.replyTo ? { reply_to: this.opts.replyTo } : {}),
        }),
      });
      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        return {
          sent: false,
          reason: `resend_http_${res.status}${detail ? `:${detail.slice(0, 200)}` : ""}`,
        };
      }
      const data = (await res.json().catch(() => null)) as { id?: string } | null;
      return data?.id ? { sent: true, id: data.id } : { sent: true };
    } catch (err) {
      return { sent: false, reason: err instanceof Error ? err.message : "resend_unknown" };
    }
  }
}

/** No-op sender — used when `RESEND_API_KEY` is unset (local dev, tests). */
export class NoopEmailSender implements EmailSender {
  async send(_msg: EmailMessage): Promise<EmailResult> {
    return { sent: false, reason: "email_not_configured" };
  }
}
