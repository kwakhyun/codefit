import { describe, expect, it } from "vitest";
import { AI_LESSONS, AI_TRACKS, aiContentVersion, aiLessonById } from "./catalog";
import { AI_CONTENT, correctQuizIndex } from "./content";
import {
  aiProgressNote,
  filterAiLessons,
  lessonsToReview,
  mergeAiProgress,
  parseAiCache,
  parseAiProgress,
  resolveAiProgress,
  sameAiProgress,
} from "./progress";

describe("AI learning catalog", () => {
  it("provides a complete, source-backed lesson for every searchable entry", () => {
    expect(new Set(AI_LESSONS.map((lesson) => lesson.id)).size).toBe(AI_LESSONS.length);
    for (const lesson of AI_LESSONS) {
      expect(AI_TRACKS.some((track) => track.id === lesson.track)).toBe(true);
      const content = AI_CONTENT[lesson.id];
      expect(content.guide.length).toBeGreaterThanOrEqual(3);
      expect(content.exercise.choices.length).toBeGreaterThanOrEqual(2);
      expect(content.quiz.choices.length).toBeGreaterThanOrEqual(2);
      expect(content.quiz.choices.length).toBeLessThanOrEqual(4);
      for (const choices of [content.exercise.choices, content.quiz.choices])
        expect(new Set(choices.map((choice) => choice.id)).size).toBe(choices.length);
      expect(correctQuizIndex(content.quiz)).toBeGreaterThanOrEqual(0);
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
  it("maps version 1 positions to choice ids and keeps completion", () => {
    const result = parseAiProgress(
      JSON.stringify({
        version: 1,
        lessons: {
          unknown: { step: 1, experiment: 0, completed: true },
          langchain: { step: 8, experiment: 0, completed: true },
          langgraph: { step: 2, experiment: 100, completed: false },
          "local-start": { step: 2, experiment: 1, completed: true, answer: 2, checked: true },
        },
      }),
    );
    expect(Object.keys(result).sort()).toEqual(["langgraph", "local-start"]);
    // No usable exercise choice: the quiz step is not reachable yet.
    expect(result.langgraph).toMatchObject({ step: 1, experiment: null, completed: false });
    // Quizzes were rewritten for version 2, so the old position is not shown as a selection.
    expect(result["local-start"]).toMatchObject({
      step: 2,
      experiment: "b",
      completed: true,
      answer: null,
      checked: false,
      version: aiContentVersion("local-start"),
    });
    const content = AI_CONTENT["local-start"];
    expect(resolveAiProgress(result["local-start"]!, content).experiment).toBe(
      content.exercise.choices[1].id,
    );
  });
  it("keeps quiz feedback across reloads and drops choices a lesson does not have", () => {
    const { langchain, langgraph } = parseAiProgress(
      JSON.stringify({
        version: 1,
        lessons: {
          langchain: {
            step: 2,
            experiment: "b",
            completed: false,
            answer: "a",
            checked: true,
            wrong: ["a", "a", "BAD"],
            firstAttemptCorrect: false,
            version: 2,
            updatedAt: 100,
          },
          langgraph: {
            step: 2,
            experiment: "a",
            completed: true,
            answer: "z",
            checked: true,
            version: 2,
            updatedAt: -1,
          },
        },
      }),
    );
    expect(langchain).toMatchObject({
      answer: "a",
      checked: true,
      wrong: ["a"],
      firstAttemptCorrect: false,
      updatedAt: 100,
    });
    const resolved = resolveAiProgress(langgraph!, AI_CONTENT.langgraph);
    expect(resolved).toMatchObject({ answer: null, checked: false, completed: true });
    expect(resolved.updatedAt).toBeUndefined();
  });
  it("drops selections saved for another content version but keeps completion", () => {
    const { langchain } = parseAiProgress(
      JSON.stringify({
        version: 1,
        lessons: {
          langchain: {
            step: 2,
            experiment: "a",
            completed: true,
            answer: "b",
            checked: true,
            firstAttemptCorrect: true,
            version: 99,
          },
        },
      }),
    );
    expect(langchain).toMatchObject({
      experiment: null,
      answer: null,
      completed: true,
      firstAttemptCorrect: true,
      step: 2,
    });
  });
  it("reads the account scope a cache belongs to", () => {
    expect(parseAiCache(JSON.stringify({ version: 1, scope: "user:1", lessons: {} })).scope).toBe(
      "user:1",
    );
    expect(parseAiCache(JSON.stringify({ version: 1, lessons: {} })).scope).toBeNull();
  });
});

describe("AI progress merge", () => {
  const base = { experiment: "a", answer: null, checked: false, wrong: [], version: 2 };
  it("never loses completion or a wrong first attempt from either copy", () => {
    const phone = {
      ...base,
      step: 2 as const,
      completed: true,
      firstAttemptCorrect: true,
      updatedAt: 10,
    };
    const laptop = {
      ...base,
      step: 0 as const,
      completed: false,
      firstAttemptCorrect: false,
      updatedAt: 20,
    };
    const merged = mergeAiProgress(phone, laptop)!;
    expect(merged).toMatchObject({ completed: true, firstAttemptCorrect: false, step: 0 });
    expect(merged.updatedAt).toBe(20);
    expect(sameAiProgress(mergeAiProgress(laptop, phone), merged)).toBe(true);
  });
  it("takes the newer quiz state and keeps an explored exercise", () => {
    const older = {
      ...base,
      step: 2 as const,
      completed: false,
      answer: "a",
      checked: true,
      wrong: ["a"],
      updatedAt: 1,
    };
    const newer = { ...base, experiment: null, step: 1 as const, completed: false, updatedAt: 2 };
    expect(mergeAiProgress(older, newer)).toMatchObject({
      experiment: "a",
      answer: null,
      wrong: [],
      step: 1,
    });
    expect(mergeAiProgress(undefined, newer)).toMatchObject({ step: 1 });
  });
  it("lists lessons that were not right on the first attempt", () => {
    expect(
      lessonsToReview({
        langchain: { ...base, step: 2, completed: true, firstAttemptCorrect: false },
        langgraph: { ...base, step: 2, completed: true, firstAttemptCorrect: true },
        crewai: { ...base, step: 1, completed: false },
      }).map((lesson) => lesson.id),
    ).toEqual(["langchain"]);
  });
  it("describes where progress is kept", () => {
    const status = { storageError: false, synced: true, offline: false, signedIn: true };
    expect(aiProgressNote(status)).toContain("계정에 저장");
    expect(aiProgressNote({ ...status, signedIn: false })).toContain("쿠키");
    expect(aiProgressNote({ ...status, synced: false, offline: true })).toContain(
      "이 브라우저에만",
    );
    expect(aiProgressNote({ ...status, offline: true, storageError: true })).toContain(
      "현재 탭에서만",
    );
  });
});
