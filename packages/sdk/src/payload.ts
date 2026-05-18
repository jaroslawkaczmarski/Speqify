/**
 * Pure builder for the ingest body. DOM-free so it can be unit-tested
 * against the API contract (`createAnnotationSchema` in @speqify/shared).
 */
import type {
  CreateAnnotationInput,
  HostAppContext,
  NavigationStep,
  TechnicalContext,
} from "@speqify/shared";
import { newId } from "./ids.js";

export interface ElementCapture {
  selector: string;
  xpath: string;
  html: string;
  boundingBox?: { x: number; y: number; w: number; h: number };
}

export interface StructuredInput {
  kind: "bug" | "change";
  severity: "low" | "medium" | "high";
}

export function buildAnnotationPayload(args: {
  submissionId: string;
  clientId: string;
  pageUrl: string;
  element?: ElementCapture | null;
  textNote?: string | null;
  structured?: StructuredInput | null;
  technical?: TechnicalContext | null;
  hostApp?: HostAppContext | null;
  breadcrumb?: NavigationStep[];
}): CreateAnnotationInput {
  return {
    clientAnnotationId: newId(),
    submissionId: args.submissionId,
    clientId: args.clientId,
    type: args.element ? "element" : "global",
    pageUrl: args.pageUrl,
    breadcrumb: args.breadcrumb ?? [],
    element: args.element ?? null,
    screenshot: null,
    voice: null,
    recordingVideo: null,
    recordingAudio: null,
    textNote: args.textNote ?? null,
    structured: args.structured ?? null,
    technical: args.technical ?? null,
    hostApp: args.hostApp ?? null,
    clientCreatedAt: new Date().toISOString(),
  };
}
