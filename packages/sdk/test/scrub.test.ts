import { describe, expect, it } from "vitest";
import { capArray, capString, scrubHeaders, scrubString, scrubUrl } from "../src/scrub.js";

describe("scrub", () => {
  it("redacts secret-looking substrings", () => {
    expect(scrubString("Authorization: Bearer abc.def-123")).toContain("[redacted]");
    expect(scrubString("api_key=SUPERLONGOPAQUEVALUE12345")).toContain("[redacted]");
    expect(scrubString("token: eyJhbGciOiJIUzI1NiwidHlwIjoiSldUIn0xxxxxxxxxx")).toContain(
      "[redacted]",
    );
    expect(scrubString("just a normal sentence")).toBe("just a normal sentence");
  });

  it("drops sensitive headers and redacts the rest", () => {
    const out = scrubHeaders({
      Authorization: "Bearer secret",
      Cookie: "sid=abc",
      "Content-Type": "application/json",
    });
    expect(out).not.toHaveProperty("Authorization");
    expect(out).not.toHaveProperty("Cookie");
    expect(out["Content-Type"]).toBe("application/json");
  });

  it("strips query strings from urls", () => {
    expect(scrubUrl("https://x.test/a/b?token=zzz&q=1")).toBe("https://x.test/a/b");
  });

  it("caps arrays (ring) and strings", () => {
    expect(capArray([1, 2, 3, 4, 5], 2)).toEqual([4, 5]);
    expect(capArray([1], 5)).toEqual([1]);
    expect(capString("abcdef", 3)).toBe("abc…[+3]");
  });
});
