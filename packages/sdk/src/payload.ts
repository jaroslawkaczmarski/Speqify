/**
 * Pure builder for the ingest body. Kept DOM-free so it can be unit-tested
 * against the API contract (`createAnnotationSchema` in @speqify/shared).
 */
import type { CreateAnnotationInput } from "@speqify/shared";
import { newId } from "./ids.js";

export interface ElementCapture {
  selector: string;
  xpath: string;
  html: string;
  boundingBox?: { x: number; y: number; w: number; h: number };
}

export function buildAnnotationPayload(args: {
  submissionId: string;
  clientId: string;
  pageUrl: string;
  element?: ElementCapture | null;
  textNote?: string | null;
}): CreateAnnotationInput {
  return {
    clientAnnotationId: newId(),
    submissionId: args.submissionId,
    clientId: args.clientId,
    type: args.element ? "element" : "global",
    pageUrl: args.pageUrl,
    breadcrumb: [],
    element: args.element ?? null,
    screenshot: null,
    voice: null,
    recordingVideo: null,
    recordingAudio: null,
    textNote: args.textNote ?? null,
    structured: null,
    technical: null,
    hostApp: null,
    clientCreatedAt: new Date().toISOString(),
  };
}
