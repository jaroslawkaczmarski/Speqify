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
});
