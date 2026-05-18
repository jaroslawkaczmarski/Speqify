import { describe, expect, it } from "vitest";
import { clampRects, type Rect } from "../src/redact.js";

describe("clampRects", () => {
  it("keeps in-bounds rects unchanged", () => {
    const r: Rect[] = [{ x: 10, y: 20, w: 30, h: 40 }];
    expect(clampRects(r, 100, 100)).toEqual(r);
  });

  it("clamps rects that overflow the image", () => {
    expect(clampRects([{ x: 90, y: 90, w: 50, h: 50 }], 100, 100)).toEqual([
      { x: 90, y: 90, w: 10, h: 10 },
    ]);
  });

  it("drops empty, zero-size and fully out-of-bounds rects", () => {
    expect(
      clampRects(
        [
          { x: 0, y: 0, w: 0, h: 10 },
          { x: 200, y: 200, w: 10, h: 10 },
          { x: -50, y: -50, w: 10, h: 10 },
        ],
        100,
        100,
      ),
    ).toEqual([]);
  });
});
