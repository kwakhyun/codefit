import { describe, expect, it } from "vitest";
import { DOMAINS, supportsLanguage } from "../lib/catalog";
import { problemSchema, publicProblem } from "../lib/problem";
import { scenarioFor } from "../lib/scenario-visuals";
import { practiceSeeds } from "./practice-problems";
import { seedProblems } from "./problems";

describe("built-in coding problems", () => {
  it("are valid, uniquely identified and use a language their domain supports", () => {
    expect(new Set(seedProblems.map((p) => p.id)).size).toBe(seedProblems.length);
    for (const problem of seedProblems) {
      expect(problemSchema.parse(problem), problem.id).toEqual(problem);
      expect(supportsLanguage(problem.domain, problem.language), problem.id).toBe(true);
    }
  });
  it("give every domain at least three coding problems", () => {
    for (const domain of DOMAINS)
      expect(
        seedProblems.filter((p) => p.domain === domain.id && !p.handoff).length,
        domain.id,
      ).toBeGreaterThanOrEqual(3);
  });
  it("keep the original problems' creation order ahead of the added ones", () => {
    const curated = seedProblems.filter((p) => !p.handoff);
    expect(curated[0].id).toBe("fe-search-race");
    expect(curated[0].createdAt).toBe("2026-09-01T00:00:00.000Z");
    const added = curated.filter((p) => practiceSeeds.some((s) => s.id === p.id));
    expect(added).toHaveLength(practiceSeeds.length);
    expect(added.every((p) => p.createdAt > curated[11].createdAt)).toBe(true);
  });
  it("never expose reference answers through the public shape", () => {
    for (const seed of practiceSeeds) {
      const shown = publicProblem(seedProblems.find((p) => p.id === seed.id)!);
      for (const key of ["solution", "explanation", "hints"])
        expect(shown, seed.id).not.toHaveProperty(key);
      expect(seed.solution, seed.id).not.toBe(seed.starterCode);
    }
  });
  it("reuse an illustration only where one is mapped", () => {
    expect(scenarioFor("fe-page-range")).toBe("page");
    expect(scenarioFor("mobile-offline-queue")).toBe("request");
    expect(scenarioFor("net-checksum")).toBeUndefined();
  });
});
