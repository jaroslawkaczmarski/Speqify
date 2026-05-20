/**
 * Transport port for transactional email. The API has a single sender
 * (Resend) in production; tests substitute an in-memory recorder.
 */
export interface EmailMessage {
  to: string;
  toName?: string;
  subject: string;
  /** Full HTML; the transport should also produce a text fallback. */
  html: string;
  text: string;
}

export interface EmailResult {
  /** True if the upstream accepted the message; false if no transport is
   *  configured (the graceful fallback path — caller surfaces the link). */
  sent: boolean;
  /** Provider message id when available. */
  id?: string;
  /** Reason when `sent: false` (no key, upstream error). */
  reason?: string;
}

export interface EmailSender {
  send(msg: EmailMessage): Promise<EmailResult>;
}
