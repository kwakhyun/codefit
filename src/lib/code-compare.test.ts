import { describe, expect, it } from "vitest";

import { compareCode, normalizeCode } from "./code-compare";

describe("normalizeCode", () => {
  it("normalizes line endings and ignores final blank lines", () => {
    expect(normalizeCode("const value = 1;\r\n\r\n")).toBe(
      "const value = 1;",
    );
  });
});

describe("compareCode", () => {
  it("accepts an exact attempt with a final newline", () => {
    expect(compareCode("const value = 1;", "const value = 1;\n")).toEqual({
      isExact: true,
      accuracy: 100,
      firstMismatchLine: null,
    });
  });

  it("reports the first line whose indentation differs", () => {
    const result = compareCode(
      ["function run() {", "  return true;", "}"].join("\n"),
      ["function run() {", "return true;", "}"].join("\n"),
    );

    expect(result.isExact).toBe(false);
    expect(result.firstMismatchLine).toBe(2);
    expect(result.accuracy).toBeLessThan(100);
  });

  it("returns zero accuracy for an empty attempt", () => {
    expect(compareCode("const ready = true;", "").accuracy).toBe(0);
  });
});

