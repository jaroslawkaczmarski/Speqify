import type { EmailMessage, EmailResult, EmailSender } from "./types.js";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const GMAIL_SCOPE = "https://www.googleapis.com/auth/gmail.send";

interface GmailOpts {
  /** Service-account JSON (the full credentials file) as a string. Stored as
   *  a Worker secret (`GMAIL_SA_KEY`). */
  saKey: string;
  /** Workspace user the SA impersonates via domain-wide delegation. Must be a
   *  real user — typically `admin@8cells.com`. */
  impersonate: string;
  /** Default From header. e.g. `Speqify <noreply@speqify.app>`. The From
   *  domain must be a primary or alias-domain of the impersonated user. */
  from?: string;
  replyTo?: string;
}

interface SAKey {
  client_email: string;
  private_key: string;
}

interface CachedToken {
  token: string;
  /** Unix ms when this token expires; refresh ~60s before. */
  expiresAt: number;
}

const tokenCache = new Map<string, CachedToken>();

/**
 * Sends transactional email through Gmail API, impersonating a Workspace user
 * via domain-wide delegation. Returns `{ sent: false, reason }` on failure —
 * never throws — so the calling flow can fall back to the magic-link path.
 */
export class GmailSender implements EmailSender {
  private sa: SAKey;

  constructor(private readonly opts: GmailOpts) {
    this.sa = JSON.parse(opts.saKey) as SAKey;
  }

  async send(msg: EmailMessage): Promise<EmailResult> {
    const from = this.opts.from ?? "Speqify <noreply@speqify.app>";
    try {
      const token = await this.getAccessToken();
      const raw = encodeMime({
        from,
        to: msg.toName ? `${msg.toName} <${msg.to}>` : msg.to,
        subject: msg.subject,
        html: msg.html,
        text: msg.text,
        replyTo: this.opts.replyTo,
      });
      const url = `https://gmail.googleapis.com/gmail/v1/users/${encodeURIComponent(
        this.opts.impersonate,
      )}/messages/send`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ raw }),
      });
      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        return {
          sent: false,
          reason: `gmail_http_${res.status}${detail ? `:${detail.slice(0, 200)}` : ""}`,
        };
      }
      const data = (await res.json().catch(() => null)) as { id?: string } | null;
      return data?.id ? { sent: true, id: data.id } : { sent: true };
    } catch (err) {
      return { sent: false, reason: err instanceof Error ? err.message : "gmail_unknown" };
    }
  }

  private async getAccessToken(): Promise<string> {
    const cacheKey = `${this.sa.client_email}|${this.opts.impersonate}`;
    const cached = tokenCache.get(cacheKey);
    const now = Date.now();
    if (cached && cached.expiresAt - 60_000 > now) return cached.token;

    const iat = Math.floor(now / 1000);
    const claims = {
      iss: this.sa.client_email,
      sub: this.opts.impersonate,
      scope: GMAIL_SCOPE,
      aud: TOKEN_URL,
      iat,
      exp: iat + 3600,
    };
    const assertion = await signRS256(this.sa.private_key, claims);

    const body = new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    });
    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`token_exchange_${res.status}:${detail.slice(0, 200)}`);
    }
    const data = (await res.json()) as { access_token: string; expires_in: number };
    tokenCache.set(cacheKey, {
      token: data.access_token,
      expiresAt: now + data.expires_in * 1000,
    });
    return data.access_token;
  }
}

async function signRS256(pemPrivateKey: string, claims: Record<string, unknown>): Promise<string> {
  const header = { alg: "RS256", typ: "JWT" };
  const headerB64 = b64urlEncode(new TextEncoder().encode(JSON.stringify(header)));
  const claimsB64 = b64urlEncode(new TextEncoder().encode(JSON.stringify(claims)));
  const signingInput = `${headerB64}.${claimsB64}`;

  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToBytes(pemPrivateKey),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(signingInput),
  );
  return `${signingInput}.${b64urlEncode(new Uint8Array(sig))}`;
}

function pemToBytes(pem: string): ArrayBuffer {
  const body = pem
    .replace(/-----BEGIN [^-]+-----/g, "")
    .replace(/-----END [^-]+-----/g, "")
    .replace(/\s+/g, "");
  const bin = atob(body);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

function b64urlEncode(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/=+$/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

interface MimeParts {
  from: string;
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
}

function encodeMime(p: MimeParts): string {
  const boundary = `b_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
  const subjectEnc = needsEncoding(p.subject)
    ? `=?UTF-8?B?${btoa(unescape(encodeURIComponent(p.subject)))}?=`
    : p.subject;
  const headers = [
    `From: ${p.from}`,
    `To: ${p.to}`,
    p.replyTo ? `Reply-To: ${p.replyTo}` : null,
    `Subject: ${subjectEnc}`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
  ]
    .filter(Boolean)
    .join("\r\n");

  const body = [
    `--${boundary}`,
    `Content-Type: text/plain; charset=UTF-8`,
    `Content-Transfer-Encoding: quoted-printable`,
    ``,
    qpEncode(p.text),
    `--${boundary}`,
    `Content-Type: text/html; charset=UTF-8`,
    `Content-Transfer-Encoding: quoted-printable`,
    ``,
    qpEncode(p.html),
    `--${boundary}--`,
    ``,
  ].join("\r\n");

  const raw = `${headers}\r\n\r\n${body}`;
  // Gmail API expects URL-safe base64.
  return b64urlEncode(new TextEncoder().encode(raw));
}

function needsEncoding(s: string): boolean {
  return /[^\x20-\x7e]/.test(s);
}

function qpEncode(input: string): string {
  // Minimal quoted-printable: encode non-ASCII + control chars + '='; break long lines.
  const bytes = new TextEncoder().encode(input);
  let out = "";
  let lineLen = 0;
  const writeChunk = (chunk: string) => {
    if (lineLen + chunk.length > 75) {
      out += "=\r\n";
      lineLen = 0;
    }
    out += chunk;
    lineLen += chunk.length;
    if (chunk === "\n") lineLen = 0;
  };
  for (const b of bytes) {
    if (b === 0x0a) {
      out += "\r\n";
      lineLen = 0;
    } else if (b === 0x0d) {
      // skip, normalized by \n handling
    } else if (b === 0x3d || b < 0x20 || b > 0x7e) {
      writeChunk(`=${b.toString(16).toUpperCase().padStart(2, "0")}`);
    } else {
      writeChunk(String.fromCharCode(b));
    }
  }
  return out;
}
