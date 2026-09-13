import { describe, expect, it } from "vitest";

import { lessons } from "./lessons";

describe("built-in curriculum", () => {
  it("contains five lessons for each MVP stack", () => {
    expect(lessons).toHaveLength(15);
    expect(
      lessons.filter((lesson) => lesson.stack === "javascript"),
    ).toHaveLength(5);
    expect(
      lessons.filter((lesson) => lesson.stack === "typescript"),
    ).toHaveLength(5);
    expect(lessons.filter((lesson) => lesson.stack === "react")).toHaveLength(
      5,
    );
  });

  it("uses unique IDs", () => {
    const ids = lessons.map((lesson) => lesson.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("keeps every exercise complete and ready to type", () => {
    for (const lesson of lessons) {
      expect(lesson.code.trim().length).toBeGreaterThan(30);
      expect(lesson.code).not.toMatch(/^\s*\.{3}\s*$/m);
      expect(lesson.code).not.toContain(String.fromCharCode(96).repeat(3));
      expect(lesson.useCases.length).toBeGreaterThanOrEqual(2);
      expect(lesson.hints.length).toBeGreaterThanOrEqual(2);
      expect(lesson.concepts.length).toBeGreaterThanOrEqual(2);
    }
  });
});
