import { describe, expect, it } from "vitest";
import { describeStep, extractJson } from "./ai/enhance.js";
import { composeMarkdown } from "./trackers/format.js";
import { composeAdf } from "./trackers/adf.js";
import { SCREENSHOT_EMBED } from "./trackers/media.js";
import { emptyContext } from "./capture.js";
import { TicketSchema, type Ticket } from "./ticket.js";

const ticket: Ticket = TicketSchema.parse({
  title: "Login button does nothing",
  description: "Clicking **Login** shows no response.",
  type: "bug",
  priority: "high",
  stepsToReproduce: ["Open /login", "Click Login"],
  acceptanceCriteria: ["Clicking Login authenticates the user"],
  labels: ["auth", "regression"],
});

describe("extractJson", () => {
  it("parses bare JSON", () => {
    expect(extractJson('{"a":1}')).toEqual({ a: 1 });
  });
  it("parses fenced JSON", () => {
    expect(extractJson('```json\n{"a":1}\n```')).toEqual({ a: 1 });
  });
  it("parses JSON embedded in prose", () => {
    expect(extractJson('Sure! {"a":1} done')).toEqual({ a: 1 });
  });
  it("throws on garbage", () => {
    expect(() => extractJson("no json here")).toThrow();
  });
});

describe("composeMarkdown", () => {
  const body = composeMarkdown(ticket);
  it("includes steps and criteria", () => {
    expect(body).toContain("## Steps to reproduce");
    expect(body).toContain("1. Open /login");
    expect(body).toContain("## Acceptance criteria");
    expect(body).toContain("- [ ] Clicking Login authenticates the user");
  });
});

describe("composeAdf", () => {
  const doc = composeAdf(ticket);
  it("produces a versioned doc with headings", () => {
    expect((doc as { type: string }).type).toBe("doc");
    const types = (doc.content ?? []).map((n) => n.type);
    expect(types).toContain("heading");
    expect(types).toContain("orderedList");
    expect(types).toContain("bulletList");
  });
});

describe("describeStep", () => {
  it("summarizes each interaction kind", () => {
    expect(describeStep({ kind: "click", at: 0, target: "button#go", text: "Go" })).toContain("Click button#go");
    expect(describeStep({ kind: "input", at: 0, target: "#email", value: "a@b.c" })).toContain("Type into #email");
    expect(describeStep({ kind: "nav", at: 0, url: "https://x.test/" })).toContain("https://x.test/");
    expect(describeStep({ kind: "key", at: 0, key: "Enter" })).toContain("Enter");
  });
});

describe("composeMarkdown with observed steps", () => {
  it("includes a reproduction-steps timeline from context", () => {
    const ctx = emptyContext({ url: "https://x.test/", title: "X", userAgent: "UA", viewport: { w: 1, h: 1, dpr: 1 } });
    ctx.steps = [
      { kind: "click", at: 1000, target: "button#go", text: "Go" },
      { kind: "nav", at: 2000, url: "https://x.test/next" },
    ];
    const body = composeMarkdown(ticket, ctx);
    expect(body.startsWith("**Where it happened:** https://x.test/")).toBe(true);
    expect(body).toContain("Observed steps");
    expect(body).toContain("Click button#go");
  });
});

describe("SCREENSHOT_EMBED", () => {
  it("marks GitHub as the only tracker without API image embed", () => {
    expect(SCREENSHOT_EMBED.github).toBe(false);
    expect(SCREENSHOT_EMBED.gitlab).toBe(true);
    expect(SCREENSHOT_EMBED.jira).toBe(true);
    expect(SCREENSHOT_EMBED.linear).toBe(true);
  });
});
