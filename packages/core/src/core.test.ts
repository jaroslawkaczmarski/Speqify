import { describe, expect, it } from "vitest";
import { extractJson } from "./ai/enhance.js";
import { composeMarkdown } from "./trackers/format.js";
import { composeAdf } from "./trackers/adf.js";
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
