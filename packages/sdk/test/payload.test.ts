import { createAnnotationSchema } from "@speqify/shared";
import { describe, expect, it } from "vitest";
import { buildAnnotationPayload } from "../src/payload.js";

describe("buildAnnotationPayload", () => {
  it("produces a body that satisfies the API ingest contract", () => {
    const body = buildAnnotationPayload({
      submissionId: "sub-1",
      clientId: "browser-1",
      pageUrl: "https://staging.acme.test/checkout",
      element: {
        selector: "button:nth-of-type(1)",
        xpath: "/html/body[1]/button[1]",
        html: "<button>Buy</button>",
        boundingBox: { x: 1, y: 2, w: 3, h: 4 },
      },
      textNote: "make primary",
    });
    const parsed = createAnnotationSchema.safeParse(body);
    expect(parsed.success).toBe(true);
    expect(body.type).toBe("element");
  });

  it("is a global annotation when no element is picked, with a unique id", () => {
    const a = buildAnnotationPayload({
      submissionId: "s",
      clientId: "c",
      pageUrl: "https://x.test/",
      textNote: "general note",
    });
    const b = buildAnnotationPayload({
      submissionId: "s",
      clientId: "c",
      pageUrl: "https://x.test/",
      textNote: "general note",
    });
    expect(a.type).toBe("global");
    expect(createAnnotationSchema.safeParse(a).success).toBe(true);
    expect(a.clientAnnotationId).not.toBe(b.clientAnnotationId);
  });

  it("stays contract-valid with structured + technical + host-app + breadcrumb", () => {
    const at = new Date().toISOString();
    const body = buildAnnotationPayload({
      submissionId: "s",
      clientId: "c",
      pageUrl: "https://x.test/p",
      textNote: "note",
      structured: { kind: "bug", severity: "high" },
      breadcrumb: [{ url: "https://x.test/p", at, action: "load" }],
      hostApp: { appVersion: "1.2.3", environment: "staging", featureFlags: { beta: true } },
      technical: {
        consoleEntries: [{ level: "error", message: "boom", at }],
        jsErrors: [{ message: "TypeError", at }],
        network: [{ method: "GET", url: "https://x.test/api", status: 500, at }],
        browser: "UA",
        os: "Win32",
        screen: { w: 1920, h: 1080, dpr: 2 },
      },
    });
    expect(createAnnotationSchema.safeParse(body).success).toBe(true);
  });

  it("carries an uploaded voice MediaRef and stays contract-valid", () => {
    const body = buildAnnotationPayload({
      submissionId: "s",
      clientId: "c",
      pageUrl: "https://x.test/",
      voice: {
        bucketKey: "panels/p1/voice/abc",
        contentType: "audio/webm",
        bytes: 1024,
        publicUrl: "https://api.speqify.app/media/panels/p1/voice/abc",
      },
    });
    expect(body.voice?.bytes).toBe(1024);
    expect(createAnnotationSchema.safeParse(body).success).toBe(true);
  });

  it("carries an uploaded screenshot MediaRef and stays contract-valid", () => {
    const body = buildAnnotationPayload({
      submissionId: "s",
      clientId: "c",
      pageUrl: "https://x.test/",
      screenshot: {
        bucketKey: "panels/p1/screenshot/xyz",
        contentType: "image/png",
        bytes: 4096,
        publicUrl: "https://api.speqify.app/media/panels/p1/screenshot/xyz",
      },
    });
    expect(body.screenshot?.contentType).toBe("image/png");
    expect(createAnnotationSchema.safeParse(body).success).toBe(true);
  });

  it("becomes a recording annotation with video+audio MediaRefs", () => {
    const media = (k: string) => ({
      bucketKey: `panels/p1/${k}/r`,
      contentType: k.includes("audio") ? "audio/webm" : "video/webm",
      bytes: 2048,
      publicUrl: `https://api.speqify.app/media/panels/p1/${k}/r`,
    });
    const body = buildAnnotationPayload({
      submissionId: "s",
      clientId: "c",
      pageUrl: "https://x.test/",
      recordingVideo: media("recording-video"),
      recordingAudio: media("recording-audio"),
    });
    expect(body.type).toBe("recording");
    expect(body.recordingVideo?.contentType).toBe("video/webm");
    expect(createAnnotationSchema.safeParse(body).success).toBe(true);
  });
});
