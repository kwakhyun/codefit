import { describe, expect, it } from "vitest";
import { AI_PATHS, lessonContext, nextLesson } from "./lesson-paths";
import { catalogLessonUrl } from "./catalog-navigation";

const params = (query: string) => new URLSearchParams(query);
const done = { step: 2 as const, experiment: "a", completed: true };

describe("next lesson follows where the lesson was opened from", () => {
  it("walks a recommended path in its own order", () => {
    const path = { path: "beginner" as const };
    expect(nextLesson("prompt-context", path).lesson?.id).toBe("agent-workflow");
    expect(nextLesson("agent-workflow", path)).toMatchObject({
      lesson: { id: "langchain" },
      via: "path",
    });
    // Skips a path lesson already finished.
    expect(nextLesson("agent-workflow", path, { langchain: done }).lesson?.id).toBe("langgraph");
  });
  it("continues in the same track after a path ends", () => {
    // A finished path lesson is still offered when nothing later in the path is left.
    expect(nextLesson("vector-search", { path: "rag" }, { "rag-eval": done })).toMatchObject({
      lesson: { id: "rag-eval" },
      via: "path",
    });
    expect(nextLesson("rag-eval", { path: "rag" })).toMatchObject({
      finished: "path",
      via: "catalog",
    });
    expect(nextLesson("local-ui", { path: "local" })).toMatchObject({ finished: "path" });
  });
  it("stays inside a workshop topic and stops at its last lesson", () => {
    const topic = { lessons: ["langgraph" as const, "observability" as const] };
    expect(nextLesson("langgraph", topic)).toMatchObject({
      lesson: { id: "observability" },
      via: "topic",
    });
    expect(nextLesson("observability", topic)).toEqual({ finished: "topic" });
  });
  it("without context uses the same track, then catalog order", () => {
    expect(nextLesson("agent-workflow")).toMatchObject({
      lesson: { id: "agent-tools" },
      via: "track",
    });
    expect(nextLesson("prompt-context")).toMatchObject({ via: "catalog" });
  });
  it("reads only known paths and lessons from the URL", () => {
    expect(lessonContext(params("path=local"))).toEqual({ path: "local" });
    expect(lessonContext(params("path=unknown"))).toEqual({});
    expect(lessonContext(params("lessons=langgraph,bad,langgraph&path=local"))).toEqual({
      lessons: ["langgraph"],
    });
    expect(catalogLessonUrl("langchain", "/learn/ai", { path: "beginner" })).toBe(
      "/learn/ai/langchain?returnTo=%2Flearn%2Fai&path=beginner",
    );
  });
  it("paths only reference catalog lessons", () => {
    for (const path of AI_PATHS) expect(path.ids.length).toBeGreaterThan(1);
  });
});
