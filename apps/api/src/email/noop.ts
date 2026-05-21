import type { EmailMessage, EmailResult, EmailSender } from "./types.js";

/**
 * Sender that never sends — used when no transactional transport is wired
 * (local dev without Gmail SA, tests). The invite flow surfaces the
 * magic-link to the PO so the operation still succeeds.
 */
export class NoopEmailSender implements EmailSender {
  async send(_msg: EmailMessage): Promise<EmailResult> {
    return { sent: false, reason: "email_not_configured" };
  }
}
