/** Minimal API client for the SDK -> Speqify ingest boundary. */
import type { CreateAnnotationInput } from "@speqify/shared";

export interface PanelInfo {
  panelId: string;
  audience: string;
  status: string;
  environmentUrl: string;
}

export class SpeqifyClient {
  constructor(
    private readonly base: string,
    private readonly token: string,
  ) {}

  async validate(): Promise<PanelInfo | null> {
    try {
      const r = await fetch(`${this.base}/panels/${this.token}`);
      if (!r.ok) return null;
      return (await r.json()) as PanelInfo;
    } catch {
      return null;
    }
  }

  async createAnnotation(body: CreateAnnotationInput): Promise<{ id: string }> {
    const r = await fetch(`${this.base}/panels/${this.token}/annotations`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!r.ok) throw new Error(`Speqify ingest failed (${r.status})`);
    return (await r.json()) as { id: string };
  }

  async submit(submissionId: string, clientId: string): Promise<void> {
    const r = await fetch(`${this.base}/panels/${this.token}/submit`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ submissionId, clientId }),
    });
    if (!r.ok) throw new Error(`Speqify submit failed (${r.status})`);
  }
}
