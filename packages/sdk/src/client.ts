/** Minimal API client for the SDK -> Speqify ingest boundary. */
import type { CreateAnnotationInput, MediaRef, SdkSessionIntro } from "@speqify/shared";

export interface SpeqifyTokens {
  /** From `?speqify_session=` in the host-app URL. */
  sessionToken: string;
  /** From `?speqify_reviewer=`. */
  reviewerToken: string;
}

export class SpeqifyClient {
  constructor(
    private readonly base: string,
    private readonly tokens: SpeqifyTokens,
  ) {}

  private headers(extra: Record<string, string> = {}): Record<string, string> {
    return {
      "x-speqify-session": this.tokens.sessionToken,
      "x-speqify-reviewer": this.tokens.reviewerToken,
      ...extra,
    };
  }

  /** Bootstrap: validates the token pair and returns the welcome-modal copy.
   *  A 4xx (revoked / wrong session / closed) returns null so the SDK can
   *  stay dormant without leaking why. */
  async fetchIntro(): Promise<SdkSessionIntro | null> {
    try {
      const url = new URL(
        `${this.base}/sdk/sessions/${encodeURIComponent(this.tokens.sessionToken)}/intro`,
      );
      url.searchParams.set("reviewer", this.tokens.reviewerToken);
      const r = await fetch(url.toString());
      if (!r.ok) return null;
      return (await r.json()) as SdkSessionIntro;
    } catch {
      return null;
    }
  }

  async createAnnotation(body: CreateAnnotationInput): Promise<{ id: string }> {
    const r = await fetch(
      `${this.base}/sdk/submissions/${encodeURIComponent(body.submissionId)}/annotations`,
      {
        method: "POST",
        headers: this.headers({ "content-type": "application/json" }),
        body: JSON.stringify(body),
      },
    );
    if (!r.ok) throw new Error(`Speqify ingest failed (${r.status})`);
    return (await r.json()) as { id: string };
  }

  async upload(
    kind: "screenshot" | "voice" | "recording-video" | "recording-audio",
    blob: Blob,
  ): Promise<MediaRef> {
    const r = await fetch(`${this.base}/sdk/uploads?kind=${kind}`, {
      method: "POST",
      headers: this.headers({ "content-type": blob.type || "application/octet-stream" }),
      body: blob,
    });
    if (!r.ok) throw new Error(`Speqify upload failed (${r.status})`);
    return (await r.json()) as MediaRef;
  }

  async submit(submissionId: string, clientId: string): Promise<void> {
    const r = await fetch(
      `${this.base}/sdk/submissions/${encodeURIComponent(submissionId)}/complete`,
      {
        method: "POST",
        headers: this.headers({ "content-type": "application/json" }),
        body: JSON.stringify({ submissionId, clientId }),
      },
    );
    if (!r.ok) throw new Error(`Speqify submit failed (${r.status})`);
  }
}
