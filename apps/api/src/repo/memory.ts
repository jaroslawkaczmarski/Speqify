import type { Annotation, Panel, Submission } from "@speqify/shared";
import { newId } from "../lib/ids.js";
import type { AnnotationCreate, Repository, UserWithSecret } from "./types.js";

/**
 * In-memory Repository — used by unit tests and local dev without D1.
 * Behaviour is the contract the D1 adapter must match.
 */
export class InMemoryRepository implements Repository {
  private panels = new Map<string, Panel>();
  private submissions = new Map<string, Submission>();
  private annotations = new Map<string, Annotation>();
  private users = new Map<string, UserWithSecret>();

  constructor(seed?: { panels?: Panel[]; users?: UserWithSecret[] }) {
    for (const p of seed?.panels ?? []) this.panels.set(p.secretToken, p);
    for (const u of seed?.users ?? []) this.users.set(u.email.toLowerCase(), u);
  }

  async getPanelByToken(token: string): Promise<Panel | null> {
    return this.panels.get(token) ?? null;
  }

  async getOrCreateSubmission(args: {
    panelId: string;
    submissionId: string;
    clientId: string;
  }): Promise<Submission> {
    const key = `${args.panelId}:${args.submissionId}`;
    const existing = this.submissions.get(key);
    if (existing) return existing;
    const created: Submission = {
      id: args.submissionId,
      panelId: args.panelId,
      clientId: args.clientId,
      complete: false,
      createdAt: new Date().toISOString(),
    };
    this.submissions.set(key, created);
    return created;
  }

  async upsertAnnotation(
    args: AnnotationCreate,
  ): Promise<{ annotation: Annotation; created: boolean }> {
    const { input } = args;
    const idemKey = `${args.panelId}:${input.clientAnnotationId}`;
    const existing = this.annotations.get(idemKey);
    if (existing) return { annotation: existing, created: false };

    const annotation: Annotation = {
      id: newId(),
      panelId: args.panelId,
      submissionId: input.submissionId,
      type: input.type,
      status: "draft",
      audience: args.audience,
      pageUrl: input.pageUrl,
      breadcrumb: input.breadcrumb,
      element: input.element,
      screenshot: input.screenshot,
      voice: input.voice,
      recordingVideo: input.recordingVideo,
      recordingAudio: input.recordingAudio,
      transcript: null,
      transcriptionStatus: null,
      textNote: input.textNote,
      structured: input.structured,
      technical: input.technical,
      hostApp: input.hostApp,
      clientCreatedAt: input.clientCreatedAt,
      serverCreatedAt: new Date().toISOString(),
      correlationId: args.correlationId,
    };
    this.annotations.set(idemKey, annotation);
    return { annotation, created: true };
  }

  async completeSubmission(args: { panelId: string; submissionId: string }): Promise<boolean> {
    const key = `${args.panelId}:${args.submissionId}`;
    const submission = this.submissions.get(key);
    if (!submission) return false;
    submission.complete = true;
    for (const a of this.annotations.values()) {
      if (a.submissionId === args.submissionId && a.status === "draft") {
        a.status = "submitted";
      }
    }
    return true;
  }

  async getUserByEmail(email: string): Promise<UserWithSecret | null> {
    return this.users.get(email.toLowerCase()) ?? null;
  }
}
