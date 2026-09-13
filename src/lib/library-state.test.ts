import { describe, expect, it } from "vitest";
import { defaultFilters, libraryUrl, problemUrl, readFilters, safeReturnTo } from "./library-state";
import { recommendProblem, trainingSummary } from "./training";
import { seedProblems } from "../data/problems";
import { publicProblem } from "./problem";
import type { AttemptSummary, ProgressSummary } from "./problem";

describe("library navigation", () => {
  it("preserves a Korean search, filters and pagination through a problem round trip", () => {
    const filters = { ...defaultFilters, search: "검색 & 정렬", level: "중", language: "typescript", sort: "newest", page: 3 };
    const library = libraryUrl(filters, "frontend", "bookmarks");
    const problem = new URL(problemUrl("fe-search-race", library, "attempt-1"), "https://codefit.example");
    expect(problem.searchParams.get("attempt")).toBe("attempt-1");
    expect(safeReturnTo(problem.searchParams.get("from")!)).toBe(library);
    expect(readFilters(new URL(library, problem).searchParams)).toEqual(filters);
  });
  it("rejects unsafe return destinations and invalid filter values", () => {
    for (const url of ["//evil.example", "https://evil.example", "javascript:alert(1)", "/\\evil", "/problems/other"]) expect(safeReturnTo(url)).toBe("/");
    const invalid = readFilters(new URLSearchParams("level=expert&language=bogus&page=Infinity&sort=unknown"));
    expect(invalid).toEqual(defaultFilters);
    expect(safeReturnTo("/?view=history&unknown=secret")).toBe("/?view=history");
  });
});
function attempt(id: string, createdAt: string, problemId = id, assisted = false, passed = true): AttemptSummary {
  return { id, problemId, createdAt, assisted, review: { passed, score: passed ? 100 : 0, criteria: [], summary: "검토 결과", improvements: [], strengths: [] } };
}
describe("training insights", () => {
  it("counts Korean calendar days and ignores duplicate reviews and future records", () => {
    const now = Date.parse("2026-09-13T15:10:00Z"); // Sep 14 in Korea
    const stats = trainingSummary([
      attempt("a", "2026-09-13T15:01:00Z", "same"), attempt("b", "2026-09-13T15:02:00Z", "same"),
      attempt("c", "2026-09-13T14:59:00Z", "helped", true), attempt("d", "2026-09-12T14:59:00Z", "failed", false, false),
      attempt("future", "2026-09-20T00:00:00Z", "same"),
    ], now);
    expect(stats.streak).toBe(3); expect(stats.activeDays).toBe(3); expect(stats.independentSolved).toBe(1);
    expect(stats.week.filter(d => d.active)).toHaveLength(3);
  });
  it("keeps yesterday's streak until today ends, but breaks it after a missed day", () => {
    const reviews = [attempt("a", "2026-09-12T16:00:00Z")];
    expect(trainingSummary(reviews, Date.parse("2026-09-13T16:00:00Z")).streak).toBe(1);
    expect(trainingSummary(reviews, Date.parse("2026-09-14T16:00:00Z")).streak).toBe(0);
  });
  it("resumes the most recent existing draft before recommending a short unsolved problem", () => {
    const p = (id: string, updatedAt: string, status: ProgressSummary["status"]): ProgressSummary => ({ problemId: id, updatedAt, status, bookmarked: false, hintsViewed: 0, solutionViewed: false });
    const progress = { [seedProblems[0].id]: p(seedProblems[0].id, "2026-09-12", "solved"), [seedProblems[1].id]: p(seedProblems[1].id, "2026-09-13", "in-progress"), missing: p("missing", "2026-09-14", "in-progress") };
    expect(recommendProblem(seedProblems.map(publicProblem), progress)?.id).toBe(seedProblems[1].id);
    const next = recommendProblem(seedProblems.map(publicProblem), { [seedProblems[0].id]: progress[seedProblems[0].id] });
    expect(next?.id).not.toBe(seedProblems[0].id);
    expect(recommendProblem([], {})).toBeUndefined();
  });
});
