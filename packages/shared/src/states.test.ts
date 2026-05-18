import { describe, expect, it } from "vitest";
import { canTransitionAnnotation, canTransitionTask, IMMUTABLE_TASK_STATUSES } from "./states.js";

describe("annotation lifecycle", () => {
  it("allows draft -> submitted -> processed", () => {
    expect(canTransitionAnnotation("draft", "submitted")).toBe(true);
    expect(canTransitionAnnotation("submitted", "processed")).toBe(true);
  });

  it("rejects skipping or reversing states", () => {
    expect(canTransitionAnnotation("draft", "processed")).toBe(false);
    expect(canTransitionAnnotation("processed", "submitted")).toBe(false);
  });
});

describe("task lifecycle", () => {
  it("supports the happy path and retry", () => {
    expect(canTransitionTask("generated", "accepted")).toBe(true);
    expect(canTransitionTask("accepted", "exported")).toBe(true);
    expect(canTransitionTask("export_failed", "exported")).toBe(true);
  });

  it("cannot resurrect a rejected or exported task", () => {
    expect(canTransitionTask("rejected", "accepted")).toBe(false);
    expect(canTransitionTask("exported", "accepted")).toBe(false);
  });

  it("protects accepted/exported tasks from analysis re-runs", () => {
    expect(IMMUTABLE_TASK_STATUSES).toContain("accepted");
    expect(IMMUTABLE_TASK_STATUSES).toContain("exported");
    expect(IMMUTABLE_TASK_STATUSES).not.toContain("generated");
  });
});
