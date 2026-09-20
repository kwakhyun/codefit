import { describe, expect, it } from "vitest";
import { AI_LESSONS, AI_TRACKS, aiLessonById } from "./catalog";
import { AI_CONTENT } from "./content";
import { filterAiLessons, parseAiProgress } from "./progress";

describe("AI learning catalog", () => {
  it("provides a complete, source-backed lesson for every searchable entry", () => {
    expect(new Set(AI_LESSONS.map((lesson) => lesson.id)).size).toBe(AI_LESSONS.length);
    for (const lesson of AI_LESSONS) {
      expect(AI_TRACKS.some((track) => track.id === lesson.track)).toBe(true);
      const content = AI_CONTENT[lesson.id];
      expect(content.guide.length).toBeGreaterThanOrEqual(3);
      expect(content.exercise.choices).toHaveLength(3);
      expect(content.quiz.choices).toHaveLength(3);
      expect(content.quiz.choices[content.quiz.answer]).toBeTruthy();
      expect(content.sources.length).toBeGreaterThan(0);
      for (const source of content.sources) expect(new URL(source.url).protocol).toBe("https:");
    }
    for (const track of AI_TRACKS)
      expect(AI_LESSONS.some((lesson) => lesson.track === track.id)).toBe(true);
    expect(aiLessonById("missing")).toBeUndefined();
  });

  it("finds Korean aliases, matches case-insensitively, and combines filters", () => {
    expect(filterAiLessons("랭체인", "all", "all").map((lesson) => lesson.id)).toEqual([
      "langchain",
    ]);
    expect(
      filterAiLessons("  LANGGRAPH  ", "frameworks", "기초").map((lesson) => lesson.id),
    ).toEqual(["langgraph"]);
    expect(filterAiLessons("langgraph", "local", "all")).toEqual([]);
    expect(filterAiLessons("langgraph", "frameworks", "입문")).toEqual([]);
    expect(filterAiLessons("not-a-tool", "all", "all")).toEqual([]);
    expect(filterAiLessons("", "all", "all")).toHaveLength(AI_LESSONS.length);
  });
});

describe("AI learning progress recovery", () => {
  it("recovers safely from corrupt and incompatible browser records", () => {
    for (const raw of [null, "{", "null", "[]", '{"version":2,"lessons":{}}'])
      expect(parseAiProgress(raw)).toEqual({});
  });
  it("ignores unknown lessons, invalid steps and impossible choices", () => {
    const result = parseAiProgress(
      JSON.stringify({
        version: 1,
        lessons: {
          unknown: { step: 1, experiment: 0, completed: true },
          langchain: { step: 8, experiment: 0, completed: true },
          langgraph: { step: 2, experiment: 100, completed: true },
          "local-start": { step: 2, experiment: 1, completed: true },
        },
      }),
    );
    expect(result).toEqual({
      langgraph: { step: 1, experiment: null, completed: false },
      "local-start": { step: 2, experiment: 1, completed: true },
    });
  });
});
