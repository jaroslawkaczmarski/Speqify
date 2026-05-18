/**
 * Pure builder for the ingest body. DOM-free so it can be unit-tested
 * against the API contract (`createAnnotationSchema` in @speqify/shared).
 */
import type {
  CreateAnnotationInput,
  HostAppContext,
  MediaRef,
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
  screenshot?: MediaRef | null;
  voice?: MediaRef | null;
  recordingVideo?: MediaRef | null;
  recordingAudio?: MediaRef | null;
  structured?: StructuredInput | null;
  technical?: TechnicalContext | null;
  hostApp?: HostAppContext | null;
  breadcrumb?: NavigationStep[];
}): CreateAnnotationInput {
  const type = args.recordingVideo ? "recording" : args.element ? "element" : "global";
  return {
    clientAnnotationId: newId(),
    submissionId: args.submissionId,
    clientId: args.clientId,
    type,
    pageUrl: args.pageUrl,
    breadcrumb: args.breadcrumb ?? [],
    element: args.element ?? null,
    screenshot: args.screenshot ?? null,
    voice: args.voice ?? null,
    recordingVideo: args.recordingVideo ?? null,
    recordingAudio: args.recordingAudio ?? null,
    textNote: args.textNote ?? null,
    structured: args.structured ?? null,
    technical: args.technical ?? null,
    hostApp: args.hostApp ?? null,
    clientCreatedAt: new Date().toISOString(),
  };
}
